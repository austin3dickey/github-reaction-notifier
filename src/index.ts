import { GitHubClient } from "./github.js";
import { StateManager } from "./state.js";
import { EmailNotifier } from "./email.js";
import type { NewReaction, EmailConfig } from "./types.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEmailConfig(): EmailConfig {
  return {
    host: getRequiredEnv("SMTP_HOST"),
    port: parseInt(process.env["SMTP_PORT"] ?? "587", 10),
    secure: process.env["SMTP_SECURE"] === "true",
    user: getRequiredEnv("SMTP_USER"),
    password: getRequiredEnv("SMTP_PASSWORD"),
    from: getRequiredEnv("EMAIL_FROM"),
    to: getRequiredEnv("EMAIL_TO"),
  };
}

async function main(): Promise<void> {
  console.log("Starting GitHub Reaction Notifier...");

  const githubToken = getRequiredEnv("GITHUB_TOKEN");
  const githubUsername = getRequiredEnv("GITHUB_USERNAME");

  const github = new GitHubClient(githubToken, githubUsername);
  const state = new StateManager();
  const emailConfig = getEmailConfig();
  const emailNotifier = new EmailNotifier(emailConfig);

  // Load existing state
  await state.load();

  // Fetch recent comments
  console.log("Fetching recent comments...");
  const comments = await github.getRecentComments();
  console.log(`Found ${comments.length} comments to check`);

  // Check each comment for new reactions
  const allNewReactions: NewReaction[] = [];

  for (const comment of comments) {
    const reactions = await github.getReactionsForComment(comment);
    const newReactions = state.findNewReactions(comment, reactions);

    if (newReactions.length > 0) {
      console.log(`Found ${newReactions.length} new reaction(s) on comment ${comment.id}`);
      allNewReactions.push(...newReactions);
    }

    // Mark all reactions as seen (including self-reactions we filtered out)
    state.markAsSeen(comment, reactions);
  }

  // Send notification if there are new reactions
  if (allNewReactions.length > 0) {
    console.log(`Sending notification for ${allNewReactions.length} new reaction(s)...`);
    await emailNotifier.sendNotification(allNewReactions);
  } else {
    console.log("No new reactions found");
  }

  // Save state
  await state.save();
  console.log("State saved. Done!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
