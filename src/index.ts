import { collectReactions, fetchViewer } from "./github.ts";
import { renderError, renderMenu } from "./menu.ts";
import { defaultStatePath, loadState, mergeReactions, saveState } from "./state.ts";

const USAGE = "Usage: node src/index.ts [mark-read]";

async function refresh(statePath: string): Promise<string> {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set. Run `gh auth login` or export a token.");
  }
  const viewer = await fetchViewer(token);
  const state = mergeReactions(await loadState(statePath), collectReactions(viewer));
  await saveState(statePath, state);
  const scriptPath = process.argv[1] ?? "";
  return renderMenu(state, [process.execPath, scriptPath, "mark-read"]);
}

async function markRead(statePath: string): Promise<void> {
  const state = await loadState(statePath);
  if (!state) return;
  await saveState(statePath, { ...state, unread: [] });
}

async function main(): Promise<void> {
  const statePath = defaultStatePath();
  const command = process.argv[2];
  if (command === undefined) {
    process.stdout.write(await refresh(statePath));
  } else if (command === "mark-read") {
    await markRead(statePath);
  } else {
    throw new Error(`Unknown command "${command}". ${USAGE}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(renderError(message));
  console.error(error);
  process.exitCode = 1;
});
