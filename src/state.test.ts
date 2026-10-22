import { strict as assert } from "node:assert";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { StateManager } from "./state.js";
import type { Comment, Reaction } from "./types.js";

async function tempStatePath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reaction-state-"));
  return join(dir, "seen-reactions.json");
}

function makeComment(id: number): Comment {
  return {
    id,
    html_url: `https://github.com/o/r/issues/1#issuecomment-${id}`,
    body: "body",
    created_at: "2026-01-01T00:00:00Z",
    user: { login: "me" },
    owner: "o",
    repo: "r",
    commentType: "issue_comment",
    number: 1,
  };
}

function makeReaction(id: number, login = "someone"): Reaction {
  return {
    id,
    user: { login, avatar_url: "", html_url: "" },
    content: "+1",
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("StateManager.load", () => {
  it("starts empty when the state file does not exist", async () => {
    const state = new StateManager(await tempStatePath());
    await state.load();
    assert.equal(state.findNewReactions(makeComment(1), [makeReaction(10)]).length, 1);
  });

  it("throws on a corrupt state file instead of starting fresh", async () => {
    const path = await tempStatePath();
    await writeFile(path, "{ not json");
    const state = new StateManager(path);
    await assert.rejects(state.load(), new RegExp(path.replaceAll("/", "\\/")));
  });

  it("throws when the state file has the wrong shape", async () => {
    const path = await tempStatePath();
    await writeFile(path, JSON.stringify({ seenReactions: [1, 2] }));
    const state = new StateManager(path);
    await assert.rejects(state.load(), /seenReactions/);
  });

  it("remembers reactions across save and load", async () => {
    const path = await tempStatePath();
    const first = new StateManager(path);
    first.markAsSeen(makeComment(1), [makeReaction(10)]);
    await first.save();

    const second = new StateManager(path);
    await second.load();
    assert.deepEqual(second.findNewReactions(makeComment(1), [makeReaction(10)]), []);
  });
});

describe("StateManager.save", () => {
  it("keeps every comment it has seen", async () => {
    const path = await tempStatePath();
    const state = new StateManager(path);
    for (let id = 1; id <= 1001; id++) {
      state.markAsSeen(makeComment(id), [makeReaction(id)]);
    }
    await state.save();

    const saved = JSON.parse(await readFile(path, "utf-8"));
    const keys = Object.keys(saved.seenReactions);
    assert.equal(keys.length, 1001);
  });
});
