import type { KnowledgeItem, Snapshot } from "../../lib/knowledge-flow/model";
import {
  Icon,
  Thumbnail,
  Badge,
  Score,
  ProjectPill,
  sourceLabels,
} from "./KnowledgePrimitives";
export function KnowledgeCard({
  item,
  snapshot,
  onOpen,
}: {
  item: KnowledgeItem;
  snapshot: Snapshot;
  onOpen: (item: KnowledgeItem) => void;
}) {
  return (
    <article className="kf-item">
      <Thumbnail item={item} />
      <div className="kf-item-body">
        <div className="kf-item-meta">
          <span>{sourceLabels[item.source_type]}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.url}
          >
            {new URL(item.url).hostname}
            <Icon name="external" size={11} />
          </a>
          <time dateTime={item.created_at}>
            {new Date(item.created_at).toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
            })}{" "}
            保存
          </time>
        </div>
        <button className="kf-title-button" onClick={() => onOpen(item)}>
          <h3>{item.title}</h3>
        </button>
        <p className={`kf-summary ${!item.summary ? "kf-muted" : ""}`}>
          {item.summary ||
            "まだ意味づけされていません。気になった理由を、ひとこと残しましょう。"}
        </p>
        <div className="kf-tags">
          {item.tag_ids.map((id) => (
            <span key={id}>
              #{snapshot.tags.find((t) => t.id === id)?.name}
            </span>
          ))}
        </div>
        <div className="kf-item-bottom">
          <div className="kf-item-connections">
            {item.project_ids.length ? (
              item.project_ids.map((id) => (
                <ProjectPill key={id} id={id} snapshot={snapshot} />
              ))
            ) : (
              <button className="kf-connect" onClick={() => onOpen(item)}>
                <Icon name="plus" size={13} /> Projectにつなぐ
              </button>
            )}
            <Badge item={item} />
          </div>
          <Score value={item.asset_score} />
        </div>
        <button className="kf-next-action" onClick={() => onOpen(item)}>
          <Icon name="arrow" size={14} />
          <span>{item.next_action || "次の一歩を決める"}</span>
        </button>
      </div>
    </article>
  );
}
