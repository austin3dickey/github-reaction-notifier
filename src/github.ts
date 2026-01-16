import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import type {
  Comment,
  GitHubEvent,
  IssueCommentEvent,
  CommitCommentEvent,
  PullRequestReviewCommentEvent,
  IssuesEvent,
  PullRequestEvent,
  Reaction,
} from "./types.js";

interface DiscussionNode {
  id: string;
  databaseId: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  reactions: {
    nodes: Array<{
      id: string;
      databaseId: number;
      content: string;
      createdAt: string;
      user: { login: string; avatarUrl: string; url: string } | null;
    }>;
  };
}

interface DiscussionCommentNode {
  id: string;
  databaseId: number;
  body: string;
  url: string;
  createdAt: string;
  author: { login: string } | null;
  discussion: {
    repository: { nameWithOwner: string };
  };
  reactions: {
    nodes: Array<{
      id: string;
      databaseId: number;
      content: string;
      createdAt: string;
      user: { login: string; avatarUrl: string; url: string } | null;
    }>;
  };
}

interface DiscussionsQueryResponse {
  user: {
    repositoryDiscussions: {
      nodes: DiscussionNode[];
    };
    repositoryDiscussionComments: {
      nodes: DiscussionCommentNode[];
    };
  };
}

export class GitHubClient {
  private octokit: Octokit;
  private graphqlClient: typeof graphql;
  private username: string;

  constructor(token: string, username: string) {
    this.octokit = new Octokit({ auth: token });
    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
    this.username = username;
  }

  async getRecentComments(): Promise<Comment[]> {
    const comments: Comment[] = [];
    const seenCommentIds = new Set<number>();

    // Fetch user events (paginated, up to 10 pages / 300 events)
    for (let page = 1; page <= 10; page++) {
      const { data: events } = await this.octokit.activity.listPublicEventsForUser({
        username: this.username,
        per_page: 30,
        page,
      });

      if (events.length === 0) break;

      for (const event of events as GitHubEvent[]) {
        const comment = this.extractComment(event);
        if (comment && !seenCommentIds.has(comment.id)) {
          seenCommentIds.add(comment.id);
          comments.push(comment);
        }
      }
    }

    return comments;
  }

  private extractComment(event: GitHubEvent): Comment | null {
    const [owner, repo] = event.repo.name.split("/");

    if (event.type === "IssueCommentEvent") {
      const e = event as IssueCommentEvent;
      if (e.payload.action !== "created") return null;
      if (e.payload.comment.user.login !== this.username) return null;

      return {
        id: e.payload.comment.id,
        html_url: e.payload.comment.html_url,
        body: e.payload.comment.body,
        created_at: e.payload.comment.created_at,
        user: e.payload.comment.user,
        owner,
        repo,
        commentType: "issue_comment",
        number: e.payload.issue.number,
      };
    }

    if (event.type === "CommitCommentEvent") {
      const e = event as CommitCommentEvent;
      if (e.payload.action !== "created") return null;
      if (e.payload.comment.user.login !== this.username) return null;

      return {
        id: e.payload.comment.id,
        html_url: e.payload.comment.html_url,
        body: e.payload.comment.body,
        created_at: e.payload.comment.created_at,
        user: e.payload.comment.user,
        owner,
        repo,
        commentType: "commit",
      };
    }

    if (event.type === "PullRequestReviewCommentEvent") {
      const e = event as PullRequestReviewCommentEvent;
      if (e.payload.action !== "created") return null;
      if (e.payload.comment.user.login !== this.username) return null;

      return {
        id: e.payload.comment.id,
        html_url: e.payload.comment.html_url,
        body: e.payload.comment.body,
        created_at: e.payload.comment.created_at,
        user: e.payload.comment.user,
        owner,
        repo,
        commentType: "pull_request_review",
        number: e.payload.pull_request.number,
      };
    }

    if (event.type === "IssuesEvent") {
      const e = event as IssuesEvent;
      if (e.payload.action !== "opened") return null;
      if (!e.payload.issue.user || e.payload.issue.user.login !== this.username) return null;

      return {
        id: e.payload.issue.id,
        html_url: e.payload.issue.html_url,
        body: e.payload.issue.body,
        created_at: e.payload.issue.created_at,
        user: e.payload.issue.user,
        owner,
        repo,
        commentType: "issue_body",
        number: e.payload.issue.number,
      };
    }

    if (event.type === "PullRequestEvent") {
      const e = event as PullRequestEvent;
      if (e.payload.action !== "opened") return null;
      if (!e.payload.pull_request.user || e.payload.pull_request.user.login !== this.username) return null;

      return {
        id: e.payload.pull_request.id,
        html_url: e.payload.pull_request.html_url,
        body: e.payload.pull_request.body,
        created_at: e.payload.pull_request.created_at,
        user: e.payload.pull_request.user,
        owner,
        repo,
        commentType: "pr_body",
        number: e.payload.pull_request.number,
      };
    }

    return null;
  }

  async getReactionsForComment(comment: Comment): Promise<Reaction[]> {
    try {
      let response;

      switch (comment.commentType) {
        case "issue_comment":
          response = await this.octokit.reactions.listForIssueComment({
            owner: comment.owner,
            repo: comment.repo,
            comment_id: comment.id,
          });
          break;

        case "commit":
          response = await this.octokit.reactions.listForCommitComment({
            owner: comment.owner,
            repo: comment.repo,
            comment_id: comment.id,
          });
          break;

        case "pull_request_review":
          response = await this.octokit.reactions.listForPullRequestReviewComment({
            owner: comment.owner,
            repo: comment.repo,
            comment_id: comment.id,
          });
          break;

        case "issue_body":
        case "pr_body":
          // Both issues and PRs use the same endpoint (PRs are issues in GitHub's API)
          if (!comment.number) {
            console.error(`Missing issue/PR number for comment ${comment.id}`);
            return [];
          }
          response = await this.octokit.reactions.listForIssue({
            owner: comment.owner,
            repo: comment.repo,
            issue_number: comment.number,
          });
          break;

        case "discussion":
        case "discussion_comment":
          // Discussions use GraphQL - reactions are fetched inline
          return [];
      }

      if (!response) {
        return [];
      }

      return response.data.map((r) => ({
        id: r.id,
        user: {
          login: r.user?.login ?? "unknown",
          avatar_url: r.user?.avatar_url ?? "",
          html_url: r.user?.html_url ?? "",
        },
        content: r.content as Reaction["content"],
        created_at: r.created_at,
      }));
    } catch (error) {
      // Comment may have been deleted or we don't have access
      console.error(`Failed to fetch reactions for comment ${comment.id}:`, error);
      return [];
    }
  }

  async getDiscussionsWithReactions(): Promise<{ comments: Comment[]; reactions: Map<number, Reaction[]> }> {
    const comments: Comment[] = [];
    const reactions = new Map<number, Reaction[]>();

    const query = `
      query($username: String!) {
        user(login: $username) {
          repositoryDiscussions(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              id
              databaseId
              title
              body
              url
              createdAt
              author { login }
              repository { nameWithOwner }
              reactions(first: 100) {
                nodes {
                  id
                  databaseId
                  content
                  createdAt
                  user { login avatarUrl url }
                }
              }
            }
          }
          repositoryDiscussionComments(first: 50) {
            nodes {
              id
              databaseId
              body
              url
              createdAt
              author { login }
              discussion {
                repository { nameWithOwner }
              }
              reactions(first: 100) {
                nodes {
                  id
                  databaseId
                  content
                  createdAt
                  user { login avatarUrl url }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphqlClient<DiscussionsQueryResponse>(query, {
        username: this.username,
      });

      // Process discussions
      for (const discussion of response.user.repositoryDiscussions.nodes) {
        if (!discussion.author || discussion.author.login !== this.username) continue;

        const [owner, repo] = discussion.repository.nameWithOwner.split("/");
        const comment: Comment = {
          id: discussion.databaseId,
          html_url: discussion.url,
          body: discussion.body,
          created_at: discussion.createdAt,
          user: { login: discussion.author.login },
          owner,
          repo,
          commentType: "discussion",
        };
        comments.push(comment);

        // Map reactions
        const discussionReactions: Reaction[] = discussion.reactions.nodes
          .filter((r) => r.user && r.user.login !== this.username)
          .map((r) => ({
            id: r.databaseId,
            user: {
              login: r.user?.login ?? "unknown",
              avatar_url: r.user?.avatarUrl ?? "",
              html_url: r.user?.url ?? "",
            },
            content: this.mapGraphQLReactionContent(r.content),
            created_at: r.createdAt,
          }));
        reactions.set(discussion.databaseId, discussionReactions);
      }

      // Process discussion comments
      for (const discussionComment of response.user.repositoryDiscussionComments.nodes) {
        if (!discussionComment.author || discussionComment.author.login !== this.username) continue;

        const [owner, repo] = discussionComment.discussion.repository.nameWithOwner.split("/");
        const comment: Comment = {
          id: discussionComment.databaseId,
          html_url: discussionComment.url,
          body: discussionComment.body,
          created_at: discussionComment.createdAt,
          user: { login: discussionComment.author.login },
          owner,
          repo,
          commentType: "discussion_comment",
        };
        comments.push(comment);

        // Map reactions
        const commentReactions: Reaction[] = discussionComment.reactions.nodes
          .filter((r) => r.user && r.user.login !== this.username)
          .map((r) => ({
            id: r.databaseId,
            user: {
              login: r.user?.login ?? "unknown",
              avatar_url: r.user?.avatarUrl ?? "",
              html_url: r.user?.url ?? "",
            },
            content: this.mapGraphQLReactionContent(r.content),
            created_at: r.createdAt,
          }));
        reactions.set(discussionComment.databaseId, commentReactions);
      }
    } catch (error) {
      console.error("Failed to fetch discussions:", error);
    }

    return { comments, reactions };
  }

  private mapGraphQLReactionContent(content: string): Reaction["content"] {
    // GraphQL returns UPPERCASE, REST returns lowercase with special chars
    const mapping: Record<string, Reaction["content"]> = {
      THUMBS_UP: "+1",
      THUMBS_DOWN: "-1",
      LAUGH: "laugh",
      CONFUSED: "confused",
      HEART: "heart",
      HOORAY: "hooray",
      ROCKET: "rocket",
      EYES: "eyes",
    };
    return mapping[content] ?? "+1";
  }
}
