import assert from "node:assert/strict";
import { test } from "node:test";
import {
  captureItem,
  normalizeUrl,
  selectItems,
} from "../src/lib/knowledge-flow/model.ts";
import { createFixture } from "../src/lib/knowledge-flow/fixtures.ts";
import {
  localKnowledgeRepository,
  STORAGE_KEY,
  validateSnapshot,
} from "../src/lib/knowledge-flow/repository.ts";

const query = {
  text: "",
  view: "all",
  project_id: "",
  status: "",
  attention: "all",
};
const now = new Date("2026-09-15T12:00:00Z");
test("capture retains source and accepts only web URLs without credentials", () => {
  const item = captureItem(
    "https://youtu.be/test#section",
    "",
    now.toISOString(),
  );
  assert.equal(item.source_type, "youtube");
  assert.equal(item.url, "https://youtu.be/test");
  assert.equal(item.status, "inbox");
  assert.equal(item.asset_score, null);
  assert.equal(item.summary, "");
  assert.equal(item.why_saved, "");
  assert.equal(item.connection_reason, "");
  assert.equal(item.destination_type, "hold");
  assert.equal(item.thumbnail_url, null);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://example.com",
    "https://user:pass@example.com",
  ])
    assert.throws(() => normalizeUrl(url));
});
test("query composes keyword, status and relationship filters and uses last touched for dormancy", () => {
  const s = createFixture(now);
  assert.equal(selectItems(s, { ...query, view: "inbox" }).length, 5);
  assert.equal(selectItems(s, { ...query, view: "library" }).length, 4);
  assert.equal(
    selectItems(s, { ...query, text: "ACE 防御", project_id: "ace" }).length,
    1,
  );
  assert.ok(
    selectItems(s, { ...query, attention: "unconnected" }).every(
      (i) => i.project_ids.length === 0,
    ),
  );
  assert.equal(
    selectItems(s, { ...query, attention: "dormant" }, now.getTime()).length,
    1,
  );
  assert.equal(
    selectItems(s, { ...query, attention: "ready", project_id: "ace" }).length,
    0,
  );
  assert.equal(
    selectItems(s, { ...query, text: "選択権 ACE" }).length,
    1,
    "connection reason participates in search",
  );
  assert.equal(
    selectItems(s, { ...query, text: "Canonical" }).length,
    0,
    "destination labels do not invent a canonical destination",
  );
  s.items[8].updated_at = now.toISOString();
  assert.equal(
    selectItems(s, { ...query, attention: "dormant" }, now.getTime()).length,
    0,
  );
});
test("v1 browser snapshots migrate without losing existing edits", () => {
  const current = createFixture(now);
  const legacy = {
    ...current,
    version: 1,
    items: current.items.map(({ why_saved, connection_reason, destination_type, ...item }) => item),
  };
  legacy.items[0].output = "既存の発信候補";
  const migrated = validateSnapshot(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.items[0].why_saved, "");
  assert.equal(migrated.items[0].connection_reason, "");
  assert.equal(migrated.items[0].destination_type, "content");
  assert.equal(migrated.items[0].output, "既存の発信候補");
  assert.equal(migrated.items[1].destination_type, "hold");
});
test("local adapter reloads writes and rejects stale revisions", async () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const a = localKnowledgeRepository(storage),
    b = localKnowledgeRepository(storage);
  const initial = await a.load();
  const stale = await b.load();
  const added = captureItem("https://example.com/new", "New");
  const saved = await a.save(
    { ...initial, items: [added, ...initial.items] },
    initial.revision,
  );
  assert.equal(saved.revision, 1);
  assert.equal(saved.version, 2);
  assert.equal(
    (await localKnowledgeRepository(storage).load()).items[0].title,
    "New",
  );
  await assert.rejects(b.save(stale, stale.revision), /別のタブ/);
  assert.equal((await a.load()).items.length, 10);
  assert.ok(data.has(STORAGE_KEY));
});
test("invalid storage and unavailable writes cannot erase data or report success", async () => {
  let raw = "{broken";
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  const repo = localKnowledgeRepository(storage);
  await assert.rejects(repo.load(), /上書き/);
  assert.equal(raw, "{broken");
  raw = JSON.stringify({
    ...createFixture(now),
    items: [{ ...createFixture(now).items[0], url: "javascript:alert(1)" }],
  });
  await assert.rejects(repo.load(), /上書き/);
  raw = JSON.stringify({
    ...createFixture(now),
    items: [{ ...createFixture(now).items[0], tag_ids: ["missing"] }],
  });
  await assert.rejects(repo.load(), /上書き/);
  const unavailable = localKnowledgeRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  });
  const initial = await unavailable.load();
  await assert.rejects(unavailable.save(initial, 0), /保存できません/);
  assert.equal((await unavailable.load()).revision, 0);
});
