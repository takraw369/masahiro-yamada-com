import { useEffect, useRef, useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import type {
  KnowledgeItem,
  Snapshot,
  Status,
} from "../../lib/knowledge-flow/model";
import {
  destinationTypeLabels,
  statusLabels,
} from "../../lib/knowledge-flow/model";
import { Icon } from "./KnowledgePrimitives";
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    ref.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      ref.current?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`kf-dialog ${wide ? "kf-dialog-wide" : ""}`}
      aria-labelledby="kf-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="kf-dialog-head">
        <div>
          <span className="kf-eyebrow">KNOWLEDGE FLOW</span>
          <h2 id="kf-dialog-title">{title}</h2>
        </div>
        <button
          className="kf-icon-button"
          onClick={onClose}
          aria-label="閉じる"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Capture({
  onSave,
  onClose,
}: {
  onSave: (url: string, title: string) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave(String(form.get("url")), String(form.get("title")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="気になったら、まず残す。" onClose={onClose}>
      <form className="kf-form" onSubmit={submit}>
        <p className="kf-muted">
          分類はあとから。URLひとつで、次の流れが始まります。
        </p>
        <label>
          URL <span>必須</span>
          <input
            autoFocus
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://…"
            required
            maxLength={4000}
            autoComplete="off"
          />
        </label>
        <label>
          タイトル <span>任意</span>
          <input name="title" placeholder="何が気になった？" maxLength={240} />
        </label>
        <p className="kf-form-note">
          この端末のデモに保存します。保存後に「なぜ気になった？」を一言だけ残せます。
        </p>
        {error && (
          <p role="alert" className="kf-error">
            {error}
          </p>
        )}
        <button className="kf-primary" disabled={busy} type="submit">
          <Icon name="plus" />
          {busy ? "保存中…" : "Inboxに保存"}
        </button>
      </form>
    </Modal>
  );
}
export function ItemEditor({
  item,
  snapshot,
  onSave,
  onClose,
}: {
  item: KnowledgeItem;
  snapshot: Snapshot;
  onSave: (item: KnowledgeItem, tagNames: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const [tags, setTags] = useState(
    snapshot.tags
      .filter((t) => item.tag_ids.includes(t.id))
      .map((t) => t.name)
      .join(", "),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<KnowledgeItem>) =>
    setDraft((d) => ({ ...d, ...patch }));
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (
        ["connected", "developing", "ready"].includes(draft.status) &&
        !draft.project_ids.length
      )
        throw new Error(
          "このステータスには、接続先のProjectを選んでください。",
        );
      if (draft.status === "ready" && !draft.output.trim())
        throw new Error("公開準備には、Destinationを記入してください。");
      await onSave(
        {
          ...draft,
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          why_saved: draft.why_saved.trim(),
          connection_reason: draft.connection_reason.trim(),
          output: draft.output.trim(),
          next_action: draft.next_action.trim(),
        },
        tags
          .split(/[,、]/)
          .map((t) => t.trim())
          .filter(Boolean),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="意味を見つけて、つなぐ。" onClose={onClose} wide>
      <form className="kf-form" onSubmit={submit}>
        <a
          className="kf-source-link"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.url}
          <Icon name="external" size={15} />
        </a>
        <label>
          タイトル
          <input
            autoFocus
            required
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            maxLength={240}
          />
        </label>
        <label>
          なぜ保存した？ <span>MASA自身の一次メモ</span>
          <textarea
            value={draft.why_saved}
            onChange={(e) => update({ why_saved: e.target.value })}
            rows={2}
            maxLength={800}
            placeholder="その瞬間、何が引っかかった？ 何に使えそうと思った？"
          />
        </label>
        <label>
          要約・この情報の意味 <span>将来はAI下書き＋本人編集</span>
          <textarea
            value={draft.summary}
            onChange={(e) => update({ summary: e.target.value })}
            rows={3}
            maxLength={1600}
            placeholder="何が書いてあり、自分にとってどんな意味がある？"
          />
        </label>
        <div className="kf-form-grid">
          <label>
            Theme
            <select
              aria-label="Theme"
              value={draft.theme_id ?? ""}
              onChange={(e) => update({ theme_id: e.target.value || null })}
            >
              <option value="">まだ決めない</option>
              {snapshot.themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ステータス
            <select
              aria-label="ステータス"
              value={draft.status}
              onChange={(e) => update({ status: e.target.value as Status })}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="kf-project-choices">
          <legend>
            つなぐProject <span>複数選択可</span>
          </legend>
          {snapshot.projects.map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={draft.project_ids.includes(p.id)}
                onChange={(e) =>
                  update({
                    project_ids: e.target.checked
                      ? [...draft.project_ids, p.id]
                      : draft.project_ids.filter((id) => id !== p.id),
                  })
                }
              />
              <span>
                <strong>{p.name}</strong>
                <small>{p.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label>
          なぜここにつながる？ <span>接続の理由</span>
          <textarea
            value={draft.connection_reason}
            onChange={(e) => update({ connection_reason: e.target.value })}
            rows={2}
            maxLength={1000}
            placeholder="例：ACEの『選択権を本人へ戻す』考え方と、この研究の○○が重なる"
          />
        </label>
        <div className="kf-form-grid">
          <label>
            Destination <span>次に何へ育てる？</span>
            <select
              aria-label="Destination type"
              value={draft.destination_type}
              onChange={(e) =>
                update({
                  destination_type: e.target
                    .value as KnowledgeItem["destination_type"],
                })
              }
            >
              {Object.entries(destinationTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destinationの具体名
            <input
              value={draft.output}
              onChange={(e) => update({ output: e.target.value })}
              placeholder="例：ACE Research / note草稿 / Canonical候補"
              maxLength={240}
            />
          </label>
        </div>
        <label>
          次の一歩
          <input
            value={draft.next_action}
            onChange={(e) => update({ next_action: e.target.value })}
            placeholder="次に何をすると、この情報が活きる？"
            maxLength={240}
          />
        </label>
        <div className="kf-form-grid">
          <label>
            タグ <span>カンマ区切り</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            資産スコア <span>手動・0〜100</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={draft.asset_score ?? ""}
              placeholder="未評価"
              onChange={(e) =>
                update({
                  asset_score:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <p className="kf-form-note">
          Destinationは「発信」だけではありません。Research・Project・Canonical・保留も同じ流れで扱います。
        </p>
        {error && (
          <p role="alert" className="kf-error">
            {error}
          </p>
        )}
        <div className="kf-form-footer">
          <button type="button" className="kf-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="kf-primary" type="submit" disabled={busy}>
            <Icon name="check" />
            {busy ? "保存中…" : "変更を保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
