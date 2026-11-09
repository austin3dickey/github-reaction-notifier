import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ReactionItem, State } from "./types.ts";

export function defaultStatePath(): string {
  const stateHome = process.env["XDG_STATE_HOME"] || join(homedir(), ".local", "state");
  return join(stateHome, "github-reaction-notifier", "state.json");
}

function isReactionItem(value: unknown): value is ReactionItem {
  if (typeof value !== "object" || value === null) return false;
  const fields = ["id", "content", "createdAt", "user", "url", "label"] as const;
  return fields.every((field) => typeof (value as Record<string, unknown>)[field] === "string");
}

function isState(value: unknown): value is State {
  if (typeof value !== "object" || value === null) return false;
  const { seen, unread } = value as { seen?: unknown; unread?: unknown };
  return (
    Array.isArray(seen) &&
    seen.every((id) => typeof id === "string") &&
    Array.isArray(unread) &&
    unread.every(isReactionItem)
  );
}

/** Reads the state file, returning null if it does not exist yet. */
export async function loadState(path: string): Promise<State | null> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const fixHint = "Delete it to start over; existing reactions will be marked as seen.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`State file ${path} is not valid JSON. ${fixHint}`, { cause: error });
  }
  if (!isState(parsed)) {
    throw new Error(`State file ${path} must have "seen" and "unread" arrays. ${fixHint}`);
  }
  return parsed;
}

/** Writes the state file atomically so a concurrent reader never sees a partial file. */
export async function saveState(path: string, state: State): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempPath, path);
}

/**
 * Adds reactions not seen before to the unread list.
 *
 * With no previous state, every current reaction is marked as seen so the first run does
 * not report the whole history. "seen" holds only the current reactions, which keeps the
 * file small: items outside the fetched window never come back into it.
 */
export function mergeReactions(previous: State | null, current: ReactionItem[]): State {
  const seen = current.map((reaction) => reaction.id);
  if (!previous) return { seen, unread: [] };

  const seenBefore = new Set(previous.seen);
  const fresh = current.filter((reaction) => !seenBefore.has(reaction.id));
  const unread = [...fresh, ...previous.unread].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return { seen, unread };
}
