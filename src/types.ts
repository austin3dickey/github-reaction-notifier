export interface ReactionItem {
  id: string;
  content: string;
  createdAt: string;
  user: string;
  url: string;
  label: string;
}

export interface State {
  seen: string[];
  unread: ReactionItem[];
}
