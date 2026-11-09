import { strict as assert } from "node:assert";
import { afterEach, describe, it, mock } from "node:test";
import { collectReactions, fetchViewer } from "./github.ts";
import type { ReactableNode, Viewer } from "./github.ts";

function node(url: string, reactions: Array<[string, string | null]>): ReactableNode {
  return {
    url,
    bodyText: "body",
    reactions: {
      nodes: reactions.map(([id, login]) => ({
        id,
        content: "THUMBS_UP",
        createdAt: "2026-11-01T00:00:00Z",
        user: login ? { login } : null,
      })),
    },
  };
}

function makeViewer(overrides: Partial<Viewer> = {}): Viewer {
  return {
    login: "me",
    issueComments: { nodes: [] },
    issues: { nodes: [] },
    pullRequests: { nodes: [] },
    commitComments: { nodes: [] },
    repositoryDiscussions: { nodes: [] },
    repositoryDiscussionComments: { nodes: [] },
    contributionsCollection: { pullRequestReviewContributions: { nodes: [] } },
    ...overrides,
  };
}

describe("collectReactions", () => {
  it("returns nothing when there are no items", () => {
    assert.deepEqual(collectReactions(makeViewer()), []);
  });

  it("includes every source, including reviews and their comments", () => {
    const review = node("https://github.com/o/r/pull/1#review", [["r1", "a"]]);
    review.comments = { nodes: [node("https://github.com/o/r/pull/1#rc", [["r2", "b"]])] };
    const viewer = makeViewer({
      issueComments: { nodes: [node("https://github.com/o/r/issues/1#c", [["r3", "c"]])] },
      issues: { nodes: [node("https://github.com/o/r/issues/2", [["r4", "c"]])] },
      pullRequests: { nodes: [node("https://github.com/o/r/pull/3", [["r5", "c"]])] },
      commitComments: { nodes: [node("https://github.com/o/r/commit/x", [["r6", "c"]])] },
      repositoryDiscussions: {
        nodes: [node("https://github.com/o/r/discussions/4", [["r7", "c"]])],
      },
      repositoryDiscussionComments: { nodes: [node("https://github.com/o/r/d#5", [["r8", "c"]])] },
      contributionsCollection: {
        pullRequestReviewContributions: {
          nodes: [{ pullRequestReview: review }, { pullRequestReview: null }],
        },
      },
    });
    const ids = collectReactions(viewer).map((reaction) => reaction.id);
    assert.deepEqual(ids.sort(), ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"]);
  });

  it("skips the viewer's own reactions and names deleted users ghost", () => {
    const viewer = makeViewer({
      issueComments: {
        nodes: [
          node("https://github.com/o/r/issues/1", [
            ["a", "me"],
            ["b", null],
          ]),
        ],
      },
    });
    const reactions = collectReactions(viewer);
    assert.deepEqual(
      reactions.map((reaction) => [reaction.id, reaction.user]),
      [["b", "ghost"]],
    );
  });

  it("deduplicates reactions that appear in more than one source", () => {
    const item = node("https://github.com/o/r/issues/1", [["a", "x"]]);
    const viewer = makeViewer({ issues: { nodes: [item] }, issueComments: { nodes: [item] } });
    assert.equal(collectReactions(viewer).length, 1);
  });

  it("prefers the title, collapses whitespace, and truncates long labels", () => {
    const titled = { ...node("https://github.com/o/r/issues/1", [["a", "x"]]), title: "Title" };
    const long = node("https://github.com/o/r/issues/2", [["b", "x"]]);
    long.bodyText = `line one\n\n${"y".repeat(100)}`;
    const reactions = collectReactions(makeViewer({ issues: { nodes: [titled, long] } }));
    assert.equal(reactions[0]?.label, "Title");
    assert.equal(reactions[1]?.label.length, 60);
    assert.ok(reactions[1]?.label.startsWith("line one yyy"));
    assert.ok(reactions[1]?.label.endsWith("…"));
  });
});

describe("fetchViewer", () => {
  afterEach(() => mock.restoreAll());

  function mockFetch(status: number, body: unknown): void {
    mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status }));
  }

  it("returns the viewer from a successful response", async () => {
    mockFetch(200, { data: { viewer: makeViewer() } });
    assert.equal((await fetchViewer("token")).login, "me");
  });

  it("throws with the HTTP status on a failed request", async () => {
    mockFetch(401, { message: "Bad credentials" });
    await assert.rejects(fetchViewer("token"), /HTTP 401.*Bad credentials/);
  });

  it("throws with the GraphQL error messages", async () => {
    mockFetch(200, { errors: [{ message: "first" }, { message: "second" }] });
    await assert.rejects(fetchViewer("token"), /first; second/);
  });

  it("throws when the response has no data", async () => {
    mockFetch(200, {});
    await assert.rejects(fetchViewer("token"), /no data/);
  });
});
