import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type { SeenReactionsState, Comment, Reaction, NewReaction } from "./types.js";

const STATE_FILE = "./data/seen-reactions.json";
const MAX_AGE_DAYS = 30;

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
    if (!existsSync(this.statePath)) {
      return;
    }

    try {
      const content = await readFile(this.statePath, "utf-8");
      this.state = JSON.parse(content);
    } catch (error) {
      console.error("Failed to load state file, starting fresh:", error);
    }
  }

  async save(): Promise<void> {
    this.state.lastUpdated = new Date().toISOString();
    this.pruneOldEntries();
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

  private pruneOldEntries(): void {
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    // We don't have timestamps for individual entries, so we'll keep track
    // by limiting total entries. Keep most recent 1000 comments.
    const entries = Object.entries(this.state.seenReactions);
    if (entries.length > 1000) {
      // Keep only the last 1000 entries
      const toKeep = entries.slice(-1000);
      this.state.seenReactions = Object.fromEntries(toKeep);
    }
  }
}
