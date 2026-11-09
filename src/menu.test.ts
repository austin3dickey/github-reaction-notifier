import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { renderError, renderMenu } from "./menu.ts";
import type { ReactionItem } from "./types.ts";

const COMMAND = ["/bin/node", "/path/index.ts", "mark-read"];

function reaction(overrides: Partial<ReactionItem> = {}): ReactionItem {
  return {
    id: "a",
    content: "ROCKET",
    createdAt: "2026-11-01T00:00:00Z",
    user: "octocat",
    url: "https://github.com/owner/repo/issues/1#issuecomment-1",
    label: "Nice work",
    ...overrides,
  };
}

describe("renderMenu", () => {
  it("shows an empty icon and no mark-read item with nothing unread", () => {
    const output = renderMenu({ seen: [], unread: [] }, COMMAND);
    assert.ok(output.startsWith("| sfimage=hand.thumbsup\n"));
    assert.match(output, /No new reactions/);
    assert.doesNotMatch(output, /Mark all as read/);
  });

  it("shows the count and one linked line per reaction", () => {
    const output = renderMenu({ seen: [], unread: [reaction(), reaction({ id: "b" })] }, COMMAND);
    const lines = output.split("\n");
    assert.equal(lines[0], "2 | sfimage=hand.thumbsup.fill");
    assert.equal(
      lines[2],
      "🚀 octocat on owner/repo: Nice work | href=https://github.com/owner/repo/issues/1#issuecomment-1",
    );
  });

  it("builds a quoted mark-read command", () => {
    const output = renderMenu({ seen: [], unread: [reaction()] }, COMMAND);
    assert.match(
      output,
      /Mark all as read \| bash="\/bin\/node" param1="\/path\/index.ts" param2="mark-read" terminal=false refresh=true/,
    );
  });

  it("keeps pipes in labels from being read as parameters", () => {
    const output = renderMenu({ seen: [], unread: [reaction({ label: "a | b" })] }, COMMAND);
    assert.match(output, /a ¦ b \| href=/);
  });

  it("falls back to the raw content for unknown reaction types", () => {
    const output = renderMenu({ seen: [], unread: [reaction({ content: "NEW_ONE" })] }, COMMAND);
    assert.match(output, /NEW_ONE octocat/);
  });
});

describe("renderError", () => {
  it("shows a warning icon and each message line in red", () => {
    const output = renderError("first\nsecond");
    assert.equal(
      output,
      "| sfimage=exclamationmark.triangle\n---\nfirst | color=red\nsecond | color=red\n",
    );
  });
});
