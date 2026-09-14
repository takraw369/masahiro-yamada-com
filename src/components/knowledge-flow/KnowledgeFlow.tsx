import { useEffect, useRef, useState } from "react";
import {
  captureItem,
  isInbox,
  normalizeUrl,
  selectItems,
  statusLabels,
} from "../../lib/knowledge-flow/model";
import type {
  KnowledgeItem,
  KnowledgeQuery,
  Snapshot,
  Status,
  View,
} from "../../lib/knowledge-flow/model";
import { localKnowledgeRepository } from "../../lib/knowledge-flow/repository";
import type { KnowledgeRepository } from "../../lib/knowledge-flow/repository";
import "./knowledge-flow.css";

import { Icon, ProjectPill } from "./KnowledgePrimitives";
import { KnowledgeCard } from "./KnowledgeCard";
import { Capture, ItemEditor } from "./KnowledgeDialogs";
import { FlowView } from "./FlowView";
const viewLabels = { inbox: "Inbox", library: "Library", flow: "Flow" };
const viewDescriptions = {
  inbox: "出会った情報を、次の可能性へ。",
  library: "意味を見つけた情報を、いつでも使える資産に。",
  flow: "ひとつの情報が、何につながり、どこへ向かうか。",
};
const initialQuery: KnowledgeQuery = {
  text: "",
  view: "inbox",
  project_id: "",
  attention: "all",
  status: "",
};
export default function KnowledgeFlow() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const repo = useRef<KnowledgeRepository | null>(null);
  const [query, setQuery] = useState<KnowledgeQuery>(initialQuery);
  const [view, setView] = useState<View>("inbox");
  const [capture, setCapture] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      repo.current = localKnowledgeRepository(window.localStorage);
      void repo.current
        .load()
        .then(setSnapshot)
        .catch((e) => setError(e.message));
    } catch {
      setError(
        "ブラウザの保存領域を利用できません。保存設定を確認して再読み込みしてください。",
      );
    }
    function shortcut(e: KeyboardEvent) {
      if (e.isComposing || e.repeat || document.querySelector("dialog[open]"))
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  function navigate(next: View) {
    setView(next);
    setQuery({ ...initialQuery, view: next });
  }
  function attention(value: KnowledgeQuery["attention"]) {
    setQuery({ ...initialQuery, view: "all", attention: value });
  }
  async function persist(next: Snapshot) {
    if (!snapshot || !repo.current)
      throw new Error("データの準備ができていません。");
    const saved = await repo.current.save(next, snapshot.revision);
    setSnapshot(saved);
    return saved;
  }
  async function saveCapture(url: string, title: string) {
    if (!snapshot) return;
    let normalized: string;
    try {
      normalized = normalizeUrl(url);
    } catch {
      throw new Error("有効なHTTP / HTTPSのURLを入力してください。");
    }
    const duplicate = snapshot.items.find(
      (item) => normalizeUrl(item.url) === normalized,
    );
    if (duplicate) {
      setCapture(false);
      setSelected(duplicate.id);
      setNotice("このURLは保存済みです。既存の情報を開きました。");
      return;
    }
    const item = captureItem(normalized, title);
    await persist({ ...snapshot, items: [item, ...snapshot.items] });
    navigate("inbox");
    setCapture(false);
    setSelected(item.id);
    setNotice("Inboxに保存しました。このまま意味づけできます。");
  }
  async function saveItem(item: KnowledgeItem, tagNames: string[]) {
    if (!snapshot) return;
    if (!item.title) throw new Error("タイトルを入力してください。");
    const tags = [...snapshot.tags];
    const ids = [...new Set(tagNames)].map((name) => {
      const found = tags.find((t) => t.name === name);
      if (found) return found.id;
      const tag = { id: crypto.randomUUID(), name };
      tags.push(tag);
      return tag.id;
    });
    const old = snapshot.items.find((i) => i.id === item.id)!;
    const changedProjects =
      [...old.project_ids].sort().join() !==
      [...item.project_ids].sort().join();
    const now = new Date().toISOString();
    await persist({
      ...snapshot,
      tags,
      items: snapshot.items.map((i) =>
        i.id === item.id
          ? {
              ...item,
              tag_ids: ids,
              updated_at: now,
              connected_at: changedProjects
                ? item.project_ids.length
                  ? now
                  : null
                : old.connected_at,
            }
          : i,
      ),
    });
    setSelected(null);
    setNotice(
      isInbox(item)
        ? "意味と接続を保存しました。"
        : "Libraryに保存しました。Flowでつながりを確認できます。",
    );
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "knowledge-flow-demo.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!snapshot)
    return (
      <div className="kf-loading">
        <h1>Knowledge Flow</h1>
        <p role={error ? "alert" : "status"}>
          {error || "ワークスペースを準備しています…"}
        </p>
        {error && (
          <button className="kf-secondary" onClick={() => location.reload()}>
            再読み込み
          </button>
        )}
      </div>
    );
  const items = selectItems(snapshot, query);
  const active = snapshot.items.find((i) => i.id === selected);
  const inboxCount = snapshot.items.filter(isInbox).length;
  const connected = [...snapshot.items]
    .filter((i) => i.connected_at)
    .sort((a, b) => b.connected_at!.localeCompare(a.connected_at!))
    .slice(0, 3);
  const continuing = snapshot.items
    .filter((i) => i.status === "developing" || i.status === "ready")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 2);
  const filtered =
    query.attention !== "all" || query.project_id || query.text || query.status;
  const attentionLabels = {
    all: "",
    review: "Needs Review",
    high: "High Value",
    ready: "Ready to Publish",
    unconnected: "未接続の情報",
    dormant: "半年眠っている高価値情報",
  };
  return (
    <div className="kf-app">
      <aside className="kf-sidebar">
        <a className="kf-brand" href="/dashboard/knowledge">
          <span className="kf-brand-mark">
            <Icon name="flow" size={23} />
          </span>
          <span>
            Knowledge Flow<small>MASA'S WORKSPACE</small>
          </span>
        </a>
        <button
          className="kf-primary kf-sidebar-capture"
          onClick={() => setCapture(true)}
        >
          <Icon name="plus" />
          Quick Capture
        </button>
        <p className="kf-nav-label">WORKSPACE</p>
        <nav className="kf-nav" aria-label="Knowledge views">
          {Object.entries(viewLabels).map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "is-active" : ""}
              aria-current={view === key ? "page" : undefined}
              onClick={() => navigate(key as View)}
            >
              <Icon name={key} />
              {label}
              <span>
                {key === "inbox" ? (
                  inboxCount
                ) : key === "library" ? (
                  snapshot.items.length - inboxCount
                ) : (
                  <Icon name="arrow" size={14} />
                )}
              </span>
            </button>
          ))}
        </nav>
        <p className="kf-nav-label">PROJECTS</p>
        <div className="kf-project-nav">
          {snapshot.projects.map((p) => (
            <button
              key={p.id}
              className={query.project_id === p.id ? "is-active" : ""}
              onClick={() =>
                setQuery({ ...initialQuery, view: "all", project_id: p.id })
              }
            >
              <i style={{ background: p.color }} />
              <span>{p.name}</span>
              <small>
                {
                  snapshot.items.filter((i) => i.project_ids.includes(p.id))
                    .length
                }
              </small>
            </button>
          ))}
        </div>
        <div className="kf-sidebar-note">
          <Icon name="flow" />
          <p>
            Collect less.
            <br />
            Connect more.
          </p>
          <small>情報を、次の可能性へ。</small>
        </div>
        <div className="kf-sidebar-foot">
          <a href="/dashboard">
            <Icon name="back" size={15} /> MASA OS に戻る
          </a>
          <a href="/mind">
            FLOW MIND を開く <Icon name="external" size={12} />
          </a>
          <div className="kf-profile">
            <span>M</span>
            <div>
              MASA<small>Personal workspace</small>
            </div>
            <a href="/dashboard/logout" aria-label="ログアウト">
              ↗
            </a>
          </div>
        </div>
      </aside>
      <div className="kf-workspace">
        <header className="kf-topbar">
          <span className="kf-breadcrumb">
            Workspace <span>/</span> <strong>Knowledge Flow</strong>
          </span>
          <div className="kf-topbar-right">
            <span className="kf-demo-dot" /> ローカルデモ
            <button className="kf-text-button" onClick={exportData}>
              JSONを書き出す
            </button>
          </div>
        </header>
        <div className="kf-mobile-brand">
          <strong>
            <Icon name="flow" /> Knowledge Flow
          </strong>
          <a href="/dashboard" aria-label="MASA OSに戻る">
            <Icon name="back" />
          </a>
        </div>
        <div className="kf-content">
          <section className="kf-today" aria-labelledby="kf-today-title">
            <div className="kf-section-heading">
              <div>
                <span className="kf-eyebrow">
                  <Icon name="sun" size={14} /> A LITTLE PROGRESS, EVERY DAY
                </span>
                <h1 id="kf-today-title">今日、何につなげよう。</h1>
                <p>集めた情報が、あなたの視点で動き出す。</p>
              </div>
              <span className="kf-today-date">
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                })}
              </span>
            </div>
            <div className="kf-stats">
              {[
                {
                  label: "Inbox",
                  value: inboxCount,
                  note: "意味を見つける",
                  action: () => navigate("inbox"),
                  color: "green",
                },
                {
                  label: "Needs Review",
                  value: snapshot.items.filter((i) => i.status === "review")
                    .length,
                  note: "もう一度、目を向ける",
                  action: () => attention("review"),
                  color: "amber",
                },
                {
                  label: "High Value",
                  value: snapshot.items.filter(
                    (i) => (i.asset_score ?? 0) >= 80,
                  ).length,
                  note: "育てたい情報 · 80以上",
                  action: () => attention("high"),
                  color: "blue",
                },
                {
                  label: "Ready to Publish",
                  value: snapshot.items.filter((i) => i.status === "ready")
                    .length,
                  note: "届ける準備をする",
                  action: () => attention("ready"),
                  color: "rose",
                },
              ].map((stat) => (
                <button
                  key={stat.label}
                  className={`kf-stat ${stat.color}`}
                  onClick={stat.action}
                >
                  <span>
                    <i />
                    {stat.label}
                  </span>
                  <strong>{String(stat.value).padStart(2, "0")}</strong>
                  <small>
                    {stat.note}
                    <Icon name="arrow" size={14} />
                  </small>
                </button>
              ))}
            </div>
          </section>
          <div className="kf-columns">
            <section className="kf-collection" aria-labelledby="kf-view-title">
              <div className="kf-collection-heading">
                <div>
                  <h2 id="kf-view-title">
                    {filtered
                      ? query.project_id
                        ? snapshot.projects.find(
                            (p) => p.id === query.project_id,
                          )?.name
                        : attentionLabels[query.attention] || "Search results"
                      : viewLabels[view]}
                    <span>{items.length}</span>
                  </h2>
                  <p>
                    {filtered
                      ? "すべての情報から、今見るべきものを。"
                      : viewDescriptions[view]}
                  </p>
                </div>
                <button
                  className="kf-secondary kf-desktop-capture"
                  onClick={() => setCapture(true)}
                >
                  <Icon name="plus" size={16} /> 保存
                </button>
              </div>
              <div className="kf-search">
                <Icon name="search" />
                <input
                  ref={search}
                  aria-label="Knowledgeを検索"
                  placeholder="タイトル、タグ、Projectを検索…"
                  value={query.text}
                  onChange={(e) =>
                    setQuery((q) => ({
                      ...q,
                      view: e.target.value ? "all" : view,
                      text: e.target.value,
                    }))
                  }
                />
                <kbd>⌘ K</kbd>
              </div>
              <div className="kf-filters">
                <button
                  aria-pressed={query.attention === "unconnected"}
                  onClick={() => attention("unconnected")}
                >
                  <Icon name="link" size={13} />
                  未接続
                </button>
                <button
                  aria-pressed={query.attention === "dormant"}
                  onClick={() => attention("dormant")}
                >
                  半年眠る高価値
                </button>
                <select
                  aria-label="Projectで絞り込み"
                  value={query.project_id}
                  onChange={(e) =>
                    setQuery((q) => ({
                      ...q,
                      view: "all",
                      project_id: e.target.value,
                    }))
                  }
                >
                  <option value="">すべてのProject</option>
                  {snapshot.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="ステータスで絞り込み"
                  value={query.status}
                  onChange={(e) =>
                    setQuery((q) => ({
                      ...q,
                      view: "all",
                      status: e.target.value as Status | "",
                    }))
                  }
                >
                  <option value="">すべての状態</option>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {filtered && (
                  <button className="kf-clear" onClick={() => navigate(view)}>
                    解除 ×
                  </button>
                )}
              </div>
              <div className="kf-results-meta">
                <span>
                  {filtered
                    ? "絞り込み結果"
                    : view === "flow"
                      ? "情報から出力までの道筋"
                      : "最近保存した情報"}
                </span>
                <span>
                  {view === "flow" ? "各ステップから編集できます" : "新しい順"}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="kf-empty">
                  <Icon name="check" size={30} />
                  <h3>
                    {filtered
                      ? "条件に合う情報はありません"
                      : view === "inbox"
                        ? "Inboxが整いました"
                        : "ここから、知識を育てよう"}
                  </h3>
                  <p>
                    {filtered
                      ? "検索語や絞り込みを変えてみてください。"
                      : "保存した情報に意味とつながりを添えていきましょう。"}
                  </p>
                  <button
                    className="kf-secondary"
                    onClick={() =>
                      filtered ? navigate(view) : setCapture(true)
                    }
                  >
                    {filtered ? "絞り込みを解除" : "URLを保存する"}
                  </button>
                </div>
              ) : view === "flow" ? (
                <FlowView
                  items={items}
                  snapshot={snapshot}
                  onOpen={(i) => setSelected(i.id)}
                />
              ) : (
                <div className="kf-items">
                  {items.map((item) => (
                    <KnowledgeCard
                      key={item.id}
                      item={item}
                      snapshot={snapshot}
                      onOpen={(i) => setSelected(i.id)}
                    />
                  ))}
                </div>
              )}
              <p className="kf-list-foot">
                {items.length}件の情報 · デモの要約・スコアは体験用の編集例です
              </p>
            </section>
            <aside className="kf-context">
              <section className="kf-connected">
                <div className="kf-rail-heading">
                  <Icon name="link" size={16} />
                  <h2>Recently Connected</h2>
                </div>
                <p className="kf-rail-sub">知識が、動きはじめた場所。</p>
                {connected.length ? (
                  connected.map((item) => (
                    <button
                      key={item.id}
                      className="kf-recent-item"
                      onClick={() => setSelected(item.id)}
                    >
                      <span>
                        {item.project_ids.map((id) => (
                          <ProjectPill key={id} id={id} snapshot={snapshot} />
                        ))}
                        <small>←</small>
                      </span>
                      <strong>
                        {snapshot.themes.find((t) => t.id === item.theme_id)
                          ?.name || item.title}
                      </strong>
                      <p>{item.next_action}</p>
                    </button>
                  ))
                ) : (
                  <p className="kf-muted">
                    Projectにつなぐと、ここに表示されます。
                  </p>
                )}
              </section>
              <section className="kf-continue">
                <div className="kf-rail-heading">
                  <Icon name="arrow" size={17} />
                  <h2>Continue</h2>
                </div>
                <p className="kf-rail-sub">考えていた、その先へ。</p>
                {continuing.length ? (
                  continuing.map((item) => (
                    <button
                      key={item.id}
                      className="kf-continue-item"
                      onClick={() => setSelected(item.id)}
                    >
                      <span className="kf-eyebrow">
                        {item.status === "ready"
                          ? "READY TO PUBLISH"
                          : "IN DEVELOPMENT"}
                      </span>
                      <strong>{item.output || item.title}</strong>
                      <p>{item.next_action}</p>
                      <span className="kf-continue-link">
                        続きを考える <Icon name="arrow" size={14} />
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="kf-muted">
                    情報の状態を「育てる」にすると、ここから再開できます。
                  </p>
                )}
              </section>
              <section className="kf-path-note">
                <span className="kf-eyebrow">YOUR KNOWLEDGE, IN MOTION</span>
                <div>
                  Capture <span>→</span> Understand
                  <br />
                  Connect <span>→</span> Develop
                  <br />
                  Publish <span>→</span> Canonicalize
                </div>
                <p>
                  小さな気づきを、
                  <br />
                  何度も使える知恵に。
                </p>
                <small>公開・正本化はPhase 2で接続予定</small>
              </section>
            </aside>
          </div>
          <footer className="kf-footer">
            <span>
              <i />
              LOCAL DEMO
            </span>
            保存先はこのブラウザのみです。共有端末に個人情報を保存しないでください。
          </footer>
        </div>
      </div>
      <nav className="kf-mobile-nav" aria-label="モバイル Knowledge views">
        {Object.entries(viewLabels).map(([key, label]) => (
          <button
            key={key}
            className={view === key ? "is-active" : ""}
            aria-current={view === key ? "page" : undefined}
            onClick={() => navigate(key as View)}
          >
            <Icon name={key} />
            <span>{label}</span>
          </button>
        ))}
        <button className="kf-mobile-save" onClick={() => setCapture(true)}>
          <Icon name="plus" />
          <span>保存</span>
        </button>
      </nav>
      {notice && (
        <div className="kf-toast" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
      {capture && (
        <Capture onSave={saveCapture} onClose={() => setCapture(false)} />
      )}
      {active && !capture && (
        <ItemEditor
          key={active.id}
          item={active}
          snapshot={snapshot}
          onSave={saveItem}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
