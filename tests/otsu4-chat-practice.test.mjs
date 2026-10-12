import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("public/otsu4/chat-practice.js", "utf8");
function sandbox(initial = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const win = {};
  vm.runInNewContext(source, {
    localStorage: storage, window: win,
    document: { readyState: "loading", addEventListener() {} }
  }, { filename: "chat-practice.js" });
  return { api: win.Otsu4ChatPractice, values };
}
const session = {
  version: 1, id: "chat-20261012-law-01", date: "2026-10-12",
  items: [
    { topic: "点検・報告周期", correct: false, relatedQuestionIds: ["c06", "l29", "l53"] },
    { topic: "警戒区域", correct: true, relatedQuestionIds: ["l01"] }
  ]
};

test("chat import is idempotent, preserves app attempts, and prioritizes actual weak concepts", () => {
  const { api, values } = sandbox({
    "otsu4-study-state-v1": JSON.stringify({
      attempts: { c06: 5 }, correct: { c06: 4 },
      history: [{ id: "c06", correct: true, at: 100 }], ratings: { l01: "mastered" }
    })
  });
  assert.equal(api.importSession(session).added, true);
  const state = JSON.parse(values.get("otsu4-study-state-v1"));
  assert.equal(state.attempts.c06, 5);
  assert.equal(state.correct.c06, 4);
  assert.equal(state.history.length, 1);
  assert.equal(state.ratings.c06, "repeat");
  assert.equal(state.ratings.l29, "repeat");
  assert.equal(state.ratings.l53, "repeat");
  assert.equal(state.ratings.l01, "mastered");
  assert.equal(api.importSession(session).added, false);
  const progress = api.summary();
  assert.equal(progress.sessions, 1);
  assert.equal(progress.total, 2);
  assert.equal(progress.correct, 1);
  assert.equal(progress.weak.length, 1);
});

test("rejects malformed sessions and unrelated input without mutating app state", () => {
  const { api, values } = sandbox();
  assert.equal(api.importSession({ ...session, id: "../bad" }).ok, false);
  assert.equal(api.importSession({ ...session, items: [{ topic: "法令", correct: 1 }] }).ok, false);
  assert.equal(values.size, 0);
});

test("does not fabricate completed app attempts when importing all-correct chat sessions", () => {
  const { api, values } = sandbox();
  assert.equal(api.importSession({ ...session, items: [{ topic: "法令", correct: true }] }).ok, true);
  const data = JSON.parse(values.get("otsu4-study-state-v1"));
  assert.equal(data.attempts, undefined);
  assert.deepEqual(Object.keys(data.ratings), []);
});

test("one-tap batch import stores multiple distinct sessions and avoids duplicates", () => {
  const { api, values } = sandbox();
  const second = {
    version: 1, id: "chat-20261013-law20-01", date: "2026-10-13",
    items: [{ topic: "消防用水", correct: false, relatedQuestionIds: ["l25","l58"] }]
  };
  assert.equal(api.importBatch([session, second]).added, true);
  assert.equal(api.summary().sessions, 2);
  assert.equal(api.summary().total, 3);
  assert.equal(JSON.parse(values.get("otsu4-study-state-v1")).ratings.l25, "repeat");
  assert.equal(api.importBatch([session, second]).added, false);
  assert.equal(api.summary().sessions, 2);
  assert.equal(api.importBatch([{ ...second, id: "../bad" }]).ok, false);
});

test("correct but uncertain answers stay correct and become repeat candidates", () => {
  const { api, values } = sandbox();
  const uncertain = {
    version: 1, id: "chat-20261013-set04-20", date: "2026-10-13",
    items: [
      { topic: "準地下街の両面積条件", correct: true, review: true, relatedQuestionIds: ["l21"] },
      { topic: "立入検査", correct: false, review: false, relatedQuestionIds: ["c15"] }
    ]
  };
  assert.equal(api.importSession(uncertain).ok, true);
  const state = JSON.parse(values.get("otsu4-study-state-v1"));
  assert.equal(state.ratings.l21, "repeat");
  assert.equal(state.ratings.c15, "repeat");
  const progress = api.summary();
  assert.equal(progress.correct, 1);
  assert.equal(progress.weak.length, 1);
  assert.equal(progress.review.length, 1);
  assert.equal(progress.review[0][0], "準地下街の両面積条件");
  assert.equal(api.importSession(uncertain).added, false);
});

test("rejects a non-boolean uncertainty flag", () => {
  const { api, values } = sandbox();
  assert.equal(api.importSession({
    ...session, id: "chat-invalid-flag",
    items: [{ topic: "法令", correct: true, review: "yes" }]
  }).ok, false);
  assert.equal(values.size, 0);
});
