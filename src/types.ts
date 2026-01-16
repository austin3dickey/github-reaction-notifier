export type ReactionContent =
  | "+1"
  | "-1"
  | "laugh"
  | "confused"
  | "heart"
  | "hooray"
  | "rocket"
  | "eyes";

export interface Reaction {
  id: number;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  content: ReactionContent;
  created_at: string;
}

export interface Comment {
  id: number;
  html_url: string;
  body: string;
  created_at: string;
  user: {
    login: string;
  };
  // For fetching reactions
  owner: string;
  repo: string;
  commentType: "issue_comment" | "commit" | "pull_request_review" | "issue_body" | "pr_body" | "discussion" | "discussion_comment";
  // For issue/PR body reactions (uses number, not id)
  number?: number;
}

export interface SeenReactionsState {
  // Map of comment ID -> set of reaction IDs that have been notified
  seenReactions: Record<string, number[]>;
  lastUpdated: string | null;
}

export interface NewReaction {
  reaction: Reaction;
  comment: Comment;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string;
}

// GitHub Events API types
export interface GitHubEventBase {
  id: string;
  type: string;
  created_at: string;
  repo: {
    name: string;
  };
}

export interface IssueCommentEventPayload {
  action: string;
  comment: {
    id: number;
    html_url: string;
    body: string;
    created_at: string;
    user: {
      login: string;
    };
  };
  issue: {
    number: number;
  };
}

export interface IssueCommentEvent extends GitHubEventBase {
  type: "IssueCommentEvent";
  payload: IssueCommentEventPayload;
}

export interface CommitCommentEventPayload {
  action: string;
  comment: {
    id: number;
    html_url: string;
    body: string;
    created_at: string;
    user: {
      login: string;
    };
    commit_id: string;
  };
}

export interface CommitCommentEvent extends GitHubEventBase {
  type: "CommitCommentEvent";
  payload: CommitCommentEventPayload;
}

export interface PullRequestReviewCommentEventPayload {
  action: string;
  comment: {
    id: number;
    html_url: string;
    body: string;
    created_at: string;
    user: {
      login: string;
    };
    pull_request_review_id: number;
  };
  pull_request: {
    number: number;
  };
}

export interface PullRequestReviewCommentEvent extends GitHubEventBase {
  type: "PullRequestReviewCommentEvent";
  payload: PullRequestReviewCommentEventPayload;
}

export interface IssuesEventPayload {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string;
    html_url: string;
    created_at: string;
    user: {
      login: string;
    };
  };
}

export interface IssuesEvent extends GitHubEventBase {
  type: "IssuesEvent";
  payload: IssuesEventPayload;
}

export interface PullRequestEventPayload {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string;
    html_url: string;
    created_at: string;
    user: {
      login: string;
    };
  };
}

export interface PullRequestEvent extends GitHubEventBase {
  type: "PullRequestEvent";
  payload: PullRequestEventPayload;
}

export type GitHubEvent =
  | IssueCommentEvent
  | CommitCommentEvent
  | PullRequestReviewCommentEvent
  | IssuesEvent
  | PullRequestEvent
  | GitHubEventBase;

export const REACTION_EMOJI: Record<ReactionContent, string> = {
  "+1": "\u{1F44D}",
  "-1": "\u{1F44E}",
  laugh: "\u{1F604}",
  confused: "\u{1F615}",
  heart: "\u{2764}\u{FE0F}",
  hooray: "\u{1F389}",
  rocket: "\u{1F680}",
  eyes: "\u{1F440}",
};
