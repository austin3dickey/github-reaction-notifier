import type { ReactionItem, State } from "./types.ts";

const REACTION_EMOJI: Record<string, string> = {
  THUMBS_UP: "👍",
  THUMBS_DOWN: "👎",
  LAUGH: "😄",
  CONFUSED: "😕",
  HEART: "❤️",
  HOORAY: "🎉",
  ROCKET: "🚀",
  EYES: "👀",
};

/** SwiftBar uses "|" to start parameters, so it must not appear in menu text. */
function sanitize(text: string): string {
  return text.replaceAll("|", "¦").replace(/\s+/g, " ");
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function repoFromUrl(url: string): string {
  const [owner, repo] = new URL(url).pathname.split("/").filter(Boolean);
  return owner && repo ? `${owner}/${repo}` : url;
}

function reactionLine(reaction: ReactionItem): string {
  const emoji = REACTION_EMOJI[reaction.content] ?? reaction.content;
  const text = `${emoji} ${reaction.user} on ${repoFromUrl(reaction.url)}: ${reaction.label}`;
  return `${sanitize(text)} | href=${reaction.url}`;
}

/**
 * Renders SwiftBar plugin output for the current state.
 *
 * Args:
 *   state: The saved state.
 *   markReadCommand: Program and arguments that mark all reactions as read.
 */
export function renderMenu(state: State, markReadCommand: string[]): string {
  const count = state.unread.length;
  const lines =
    count === 0
      ? ["| sfimage=hand.thumbsup", "---", "No new reactions"]
      : [`${count} | sfimage=hand.thumbsup.fill`, "---", ...state.unread.map(reactionLine)];

  lines.push("---");
  if (count > 0) {
    const [program = "", ...args] = markReadCommand;
    const params = args.map((arg, index) => `param${index + 1}=${quote(arg)}`);
    lines.push(
      `Mark all as read | bash=${quote(program)} ${params.join(" ")} terminal=false refresh=true`,
    );
  }
  lines.push("Refresh | refresh=true");
  return `${lines.join("\n")}\n`;
}

export function renderError(message: string): string {
  const details = message.split("\n").map((line) => `${sanitize(line)} | color=red`);
  return `${["| sfimage=exclamationmark.triangle", "---", ...details].join("\n")}\n`;
}
