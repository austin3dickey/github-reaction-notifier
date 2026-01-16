import { Octokit } from "@octokit/rest";
import type {
  Comment,
  GitHubEvent,
  IssueCommentEvent,
  CommitCommentEvent,
  PullRequestReviewCommentEvent,
  Reaction,
} from "./types.js";

export class GitHubClient {
  private octokit: Octokit;
  private username: string;

  constructor(token: string, username: string) {
    this.octokit = new Octokit({ auth: token });
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
        commentType: "issue",
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
      };
    }

    return null;
  }

  async getReactionsForComment(comment: Comment): Promise<Reaction[]> {
    try {
      let response;

      switch (comment.commentType) {
        case "issue":
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
}
