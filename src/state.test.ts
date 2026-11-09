import { strict as assert } from "node:assert";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadState, mergeReactions, saveState } from "./state.ts";
import type { ReactionItem } from "./types.ts";

function reaction(id: string, createdAt = "2026-11-01T00:00:00Z"): ReactionItem {
  return { id, content: "HEART", createdAt, user: "u", url: "https://github.com/o/r", label: "l" };
}

async function tempPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reaction-state-"));
  return join(dir, "nested", "state.json");
}

describe("mergeReactions", () => {
  it("marks everything as seen on the first run without reporting it", () => {
    const state = mergeReactions(null, [reaction("a"), reaction("b")]);
    assert.deepEqual(state, { seen: ["a", "b"], unread: [] });
  });

  it("adds only reactions not seen before, newest first", () => {
    const previous = { seen: ["a"], unread: [reaction("old", "2026-10-01T00:00:00Z")] };
    const current = [
      reaction("a"),
      reaction("b", "2026-11-02T00:00:00Z"),
      reaction("c", "2026-11-03T00:00:00Z"),
    ];
    const state = mergeReactions(previous, current);
    assert.deepEqual(
      state.unread.map((item) => item.id),
      ["c", "b", "old"],
    );
  });

  it("does not report a reaction again on the next run", () => {
    const first = mergeReactions({ seen: [], unread: [] }, [reaction("a")]);
    const second = mergeReactions({ ...first, unread: [] }, [reaction("a")]);
    assert.deepEqual(second.unread, []);
  });

  it("keeps unread reactions that left the fetched window and prunes seen", () => {
    const state = mergeReactions({ seen: ["a"], unread: [reaction("a")] }, [reaction("b")]);
    assert.deepEqual(state.seen, ["b"]);
    assert.deepEqual(
      state.unread.map((item) => item.id),
      ["b", "a"],
    );
  });
});

describe("loadState and saveState", () => {
  it("returns null when the file does not exist", async () => {
    assert.equal(await loadState(await tempPath()), null);
  });

  it("round-trips state and creates missing directories", async () => {
    const path = await tempPath();
    const state = { seen: ["a"], unread: [reaction("a")] };
    await saveState(path, state);
    assert.deepEqual(await loadState(path), state);
  });

  it("throws a helpful error on invalid JSON", async () => {
    const path = await tempPath();
    await saveState(path, { seen: [], unread: [] });
    await writeFile(path, "{not json");
    await assert.rejects(loadState(path), /not valid JSON.*Delete it/);
  });

  it("throws a helpful error on the wrong shape", async () => {
    const path = await tempPath();
    await saveState(path, { seen: [], unread: [] });
    for (const bad of [{ seen: [1], unread: [] }, { seen: [] }, { seen: [], unread: [{}] }, null]) {
      await writeFile(path, JSON.stringify(bad));
      await assert.rejects(loadState(path), /must have "seen" and "unread"/);
    }
  });
});
