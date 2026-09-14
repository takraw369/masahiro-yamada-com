import type { KnowledgeItem, Snapshot } from "../../lib/knowledge-flow/model";
import { Icon, Badge, ProjectPill, sourceLabels } from "./KnowledgePrimitives";
export function FlowView({
  items,
  snapshot,
  onOpen,
}: {
  items: KnowledgeItem[];
  snapshot: Snapshot;
  onOpen: (item: KnowledgeItem) => void;
}) {
  return (
    <div className="kf-flow">
      <div className="kf-flow-labels">
        <span>01 / Source</span>
        <span>02 / Theme</span>
        <span>03 / Project</span>
        <span>04 / Output</span>
      </div>
      {items.map((item) => (
        <article className="kf-flow-row" key={item.id}>
          <button className="kf-flow-source" onClick={() => onOpen(item)}>
            <span className="kf-mobile-label">Source</span>
            <span className="kf-eyebrow">{sourceLabels[item.source_type]}</span>
            <strong>{item.title}</strong>
            <Badge item={item} />
          </button>
          <button
            className={`kf-flow-cell ${item.theme_id ? "" : "is-empty"}`}
            onClick={() => onOpen(item)}
          >
            <span className="kf-mobile-label">Theme</span>
            <Icon name="arrow" size={14} />
            <span>
              {snapshot.themes.find((t) => t.id === item.theme_id)?.name ||
                "テーマを選ぶ"}
            </span>
          </button>
          <button
            className={`kf-flow-cell ${item.project_ids.length ? "" : "is-empty"}`}
            onClick={() => onOpen(item)}
          >
            <span className="kf-mobile-label">Project</span>
            <Icon name="arrow" size={14} />
            <span>
              {item.project_ids.length
                ? item.project_ids.map((id) => (
                    <ProjectPill key={id} id={id} snapshot={snapshot} />
                  ))
                : "接続先を選ぶ"}
            </span>
          </button>
          <button
            className={`kf-flow-cell ${item.output ? "" : "is-empty"}`}
            onClick={() => onOpen(item)}
          >
            <span className="kf-mobile-label">Output</span>
            <Icon name="arrow" size={14} />
            <span>
              {item.output || "何に育てる？"}
              {item.output && <small>草稿・候補</small>}
            </span>
          </button>
        </article>
      ))}
    </div>
  );
}
