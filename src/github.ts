import type { ReactionItem } from "./types.ts";

const GRAPHQL_URL = "https://api.github.com/graphql";
const LABEL_LENGTH = 60;

const QUERY = `
fragment Item on Reactable {
  ... on IssueComment { url bodyText }
  ... on Issue { url title }
  ... on PullRequest { url title }
  ... on CommitComment { url bodyText }
  ... on Discussion { url title }
  ... on DiscussionComment { url bodyText }
  ... on PullRequestReview { url bodyText }
  ... on PullRequestReviewComment { url bodyText }
  reactions(first: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
    nodes { id content createdAt user { login } }
  }
}
query {
  viewer {
    login
    issueComments(last: 100) { nodes { ...Item } }
    issues(last: 50) { nodes { ...Item } }
    pullRequests(last: 50) { nodes { ...Item } }
    commitComments(last: 20) { nodes { ...Item } }
    repositoryDiscussions(first: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes { ...Item }
    }
    repositoryDiscussionComments(last: 50) { nodes { ...Item } }
    contributionsCollection {
      pullRequestReviewContributions(first: 50, orderBy: {direction: DESC}) {
        nodes { pullRequestReview { ...Item comments(first: 30) { nodes { ...Item } } } }
      }
    }
  }
}`;

interface RawReaction {
  id: string;
  content: string;
  createdAt: string;
  user: { login: string } | null;
}

export interface ReactableNode {
  url: string;
  title?: string;
  bodyText?: string;
  reactions: { nodes: RawReaction[] };
  comments?: { nodes: ReactableNode[] };
}

interface Connection {
  nodes: ReactableNode[];
}

export interface Viewer {
  login: string;
  issueComments: Connection;
  issues: Connection;
  pullRequests: Connection;
  commitComments: Connection;
  repositoryDiscussions: Connection;
  repositoryDiscussionComments: Connection;
  contributionsCollection: {
    pullRequestReviewContributions: {
      nodes: Array<{ pullRequestReview: ReactableNode | null }>;
    };
  };
}

interface GraphQLResponse {
  data?: { viewer: Viewer };
  errors?: Array<{ message: string }>;
}

export async function fetchViewer(token: string): Promise<Viewer> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}: ${detail}`);
  }
  const body = (await response.json()) as GraphQLResponse;
  if (body.errors?.length) {
    const messages = body.errors.map((error) => error.message).join("; ");
    throw new Error(`GitHub GraphQL query returned errors: ${messages}`);
  }
  if (!body.data) {
    throw new Error("GitHub GraphQL response had no data and no errors");
  }
  return body.data.viewer;
}

function makeLabel(node: ReactableNode): string {
  const text = (node.title ?? node.bodyText ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= LABEL_LENGTH) return text;
  return `${text.slice(0, LABEL_LENGTH - 1)}…`;
}

function allNodes(viewer: Viewer): ReactableNode[] {
  const nodes = [
    ...viewer.issueComments.nodes,
    ...viewer.issues.nodes,
    ...viewer.pullRequests.nodes,
    ...viewer.commitComments.nodes,
    ...viewer.repositoryDiscussions.nodes,
    ...viewer.repositoryDiscussionComments.nodes,
  ];
  for (const contribution of viewer.contributionsCollection.pullRequestReviewContributions.nodes) {
    const review = contribution.pullRequestReview;
    if (!review) continue;
    nodes.push(review, ...(review.comments?.nodes ?? []));
  }
  return nodes;
}

/** Flattens the viewer's items into reactions from other people, deduplicated by ID. */
export function collectReactions(viewer: Viewer): ReactionItem[] {
  const reactions = new Map<string, ReactionItem>();
  for (const node of allNodes(viewer)) {
    for (const reaction of node.reactions.nodes) {
      const user = reaction.user?.login ?? "ghost";
      if (user === viewer.login) continue;
      reactions.set(reaction.id, {
        id: reaction.id,
        content: reaction.content,
        createdAt: reaction.createdAt,
        user,
        url: node.url,
        label: makeLabel(node),
      });
    }
  }
  return [...reactions.values()];
}
