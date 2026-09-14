import { useState } from "react";
import type { ReactNode } from "react";
import type { KnowledgeItem, Snapshot } from "../../lib/knowledge-flow/model";
import { statusLabels } from "../../lib/knowledge-flow/model";
export const sourceLabels = {
  web: "ARTICLE",
  youtube: "VIDEO",
  research: "RESEARCH",
  pdf: "PDF",
  x: "X POST",
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    inbox: (
      <>
        <path d="m4 4-2 10v6h20v-6L20 4Z" />
        <path d="M2 14h6l2 3h4l2-3h6" />
      </>
    ),
    library: (
      <>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="4" height="16" rx="1" />
        <path d="m17 4 4 1 1 14-4 1Z" />
      </>
    ),
    flow: (
      <>
        <rect x="2" y="8" width="5" height="8" rx="1" />
        <rect x="17" y="3" width="5" height="6" rx="1" />
        <rect x="17" y="15" width="5" height="6" rx="1" />
        <path d="M7 12h5V6h5m-5 6v6h5" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    link: (
      <>
        <path d="m10 7 2-2a5 5 0 0 1 7 7l-2 2m-3 3-2 2a5 5 0 0 1-7-7l2-2m2 5 6-6" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.link}
    </svg>
  );
}
export function Thumbnail({ item }: { item: KnowledgeItem }) {
  const [failed, setFailed] = useState(false);
  if (item.thumbnail_url && !failed)
    return (
      <img
        className="kf-thumbnail"
        src={item.thumbnail_url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  return (
    <div
      className={`kf-thumbnail kf-art kf-art-${item.theme_id || "knowledge"}`}
      aria-label="サムネイル未取得・テーマの代替画像"
      role="img"
    >
      <span />
      <span />
      <span />
      <b>
        {item.source_type === "youtube"
          ? "▷"
          : item.theme_id === "food"
            ? "季"
            : item.theme_id === "psychology"
              ? "心"
              : item.theme_id === "flow"
                ? "流"
                : "知"}
      </b>
    </div>
  );
}
export function Badge({ item }: { item: KnowledgeItem }) {
  return (
    <span className={`kf-badge kf-status-${item.status}`}>
      <span /> {statusLabels[item.status]}
    </span>
  );
}
export function Score({ value }: { value: number | null }) {
  return (
    <span
      className={`kf-score ${value !== null && value >= 80 ? "is-high" : ""}`}
      title="資産スコア：手動評価（デモは例示）"
    >
      {value === null ? (
        "未評価"
      ) : (
        <>
          <span>↗</span> {value}
          <small>/100</small>
        </>
      )}
    </span>
  );
}
export function ProjectPill({
  id,
  snapshot,
}: {
  id: string;
  snapshot: Snapshot;
}) {
  const project = snapshot.projects.find((p) => p.id === id);
  return project ? (
    <span className="kf-project-pill">
      <i style={{ background: project.color }} />
      {project.name}
    </span>
  ) : null;
}
