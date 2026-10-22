import { readFile, writeFile } from "fs/promises";
import type { SeenReactionsState, Comment, Reaction, NewReaction } from "./types.js";

const STATE_FILE = "./data/seen-reactions.json";

function isSeenReactionsState(value: unknown): value is SeenReactionsState {
  if (typeof value !== "object" || value === null) return false;
  const { seenReactions } = value as { seenReactions?: unknown };
  if (typeof seenReactions !== "object" || seenReactions === null) return false;
  if (Array.isArray(seenReactions)) return false;
  return Object.values(seenReactions).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "number"),
  );
}

export class StateManager {
  private state: SeenReactionsState;
  private statePath: string;

  constructor(statePath: string = STATE_FILE) {
    this.statePath = statePath;
    this.state = {
      seenReactions: {},
      lastUpdated: null,
    };
  }

  async load(): Promise<void> {
    let content: string;
    try {
      content = await readFile(this.statePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    // Starting fresh on a bad file would re-send every reaction, so stop instead.
    const fixHint = "Fix or restore it from git history, or delete it to accept re-notification.";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`State file ${this.statePath} is not valid JSON. ${fixHint}`, {
        cause: error,
      });
    }
    if (!isSeenReactionsState(parsed)) {
      throw new Error(
        `State file ${this.statePath} must have a seenReactions object of number arrays. ${fixHint}`,
      );
    }
    this.state = parsed;
  }

  async save(): Promise<void> {
    this.state.lastUpdated = new Date().toISOString();
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  findNewReactions(comment: Comment, reactions: Reaction[]): NewReaction[] {
    const commentKey = String(comment.id);
    const seenIds = new Set(this.state.seenReactions[commentKey] ?? []);

    const newReactions: NewReaction[] = [];

    for (const reaction of reactions) {
      // Skip reactions from the comment author (self-reactions)
      if (reaction.user.login === comment.user.login) {
        continue;
      }

      if (!seenIds.has(reaction.id)) {
        newReactions.push({ reaction, comment });
      }
    }

    return newReactions;
  }

  markAsSeen(comment: Comment, reactions: Reaction[]): void {
    const commentKey = String(comment.id);
    const existingIds = this.state.seenReactions[commentKey] ?? [];
    const allIds = new Set([...existingIds, ...reactions.map((r) => r.id)]);
    this.state.seenReactions[commentKey] = Array.from(allIds);
  }
}
