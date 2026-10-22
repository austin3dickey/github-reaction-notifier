import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import { EmailNotifier } from "./email.js";
import type { EmailConfig, NewReaction } from "./types.js";

const config: EmailConfig = {
  host: "smtp.example.com",
  port: 587,
  secure: false,
  user: "user",
  password: "password",
  from: "from@example.com",
  to: "to@example.com",
};

interface SentMessage {
  subject: string;
  html: string;
  text: string;
}

async function send(reactions: NewReaction[]): Promise<SentMessage> {
  const transporter = nodemailer.createTransport({ jsonTransport: true });
  let sent: SentMessage | undefined;
  const sendMail = transporter.sendMail.bind(transporter);
  transporter.sendMail = (async (mail: SendMailOptions) => {
    const info = await sendMail(mail);
    sent = JSON.parse(info.message);
    return info;
  }) as typeof transporter.sendMail;

  await new EmailNotifier(config, transporter).sendNotification(reactions);
  assert.ok(sent, "expected an email to be sent");
  return sent;
}

function reactionOn(body: string, login = "someone"): NewReaction {
  return {
    reaction: {
      id: 1,
      user: { login, avatar_url: "", html_url: "" },
      content: "heart",
      created_at: "2026-01-01T00:00:00Z",
    },
    comment: {
      id: 2,
      html_url: "https://github.com/o/r/issues/3#issuecomment-2",
      body,
      created_at: "2026-01-01T00:00:00Z",
      user: { login: "me" },
      owner: "o",
      repo: "r",
      commentType: "issue_comment",
      number: 3,
    },
  };
}

describe("EmailNotifier", () => {
  it("escapes HTML in the comment preview", async () => {
    const { html, text } = await send([reactionOn("Use <details> & \"quotes\"")]);
    assert.ok(html.includes("Use &lt;details&gt; &amp; &quot;quotes&quot;"));
    assert.ok(!html.includes("<details>"));
    assert.ok(text.includes("Use <details> & \"quotes\""));
  });

  it("escapes HTML in the reacting user's login", async () => {
    const { html } = await send([reactionOn("hi", "<b>evil</b>")]);
    assert.ok(html.includes("&lt;b&gt;evil&lt;/b&gt;"));
    assert.ok(!html.includes("<b>evil</b>"));
  });

  it("truncates before escaping so entities are never cut in half", async () => {
    const { html } = await send([reactionOn("&".repeat(300))]);
    assert.ok(html.includes(`${"&amp;".repeat(247)}...`));
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(html.replace(/<[^>]*>/g, "")));
  });

  it("does not send anything for an empty list", async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    transporter.sendMail = (() => {
      throw new Error("should not send");
    }) as typeof transporter.sendMail;
    await new EmailNotifier(config, transporter).sendNotification([]);
  });
});
