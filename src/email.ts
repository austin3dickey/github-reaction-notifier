import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailConfig, NewReaction } from "./types.js";
import { REACTION_EMOJI } from "./types.js";

export class EmailNotifier {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async sendNotification(newReactions: NewReaction[]): Promise<void> {
    if (newReactions.length === 0) return;

    const subject = this.buildSubject(newReactions);
    const html = this.buildHtmlBody(newReactions);
    const text = this.buildTextBody(newReactions);

    await this.transporter.sendMail({
      from: this.config.from,
      to: this.config.to,
      subject,
      text,
      html,
    });

    console.log(`Sent email notification for ${newReactions.length} new reaction(s)`);
  }

  private buildSubject(reactions: NewReaction[]): string {
    if (reactions.length === 1) {
      const { reaction, comment } = reactions[0];
      const emoji = REACTION_EMOJI[reaction.content];
      return `${emoji} ${reaction.user.login} reacted to your comment`;
    }
    return `${reactions.length} new reactions on your GitHub comments`;
  }

  private buildHtmlBody(reactions: NewReaction[]): string {
    const reactionsHtml = reactions
      .map(({ reaction, comment }) => {
        const emoji = REACTION_EMOJI[reaction.content];
        const preview = this.truncate(comment.body, 100);

        return `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e1e4e8; border-radius: 6px;">
            <div style="margin-bottom: 10px;">
              <strong>${emoji} ${reaction.user.login}</strong> reacted to your comment
            </div>
            <div style="color: #586069; font-size: 14px; margin-bottom: 10px;">
              "${preview}"
            </div>
            <a href="${comment.html_url}" style="color: #0366d6; text-decoration: none;">
              View comment →
            </a>
          </div>
        `;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
          </style>
        </head>
        <body style="padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #24292e;">New Reactions on Your Comments</h2>
          ${reactionsHtml}
          <p style="color: #586069; font-size: 12px; margin-top: 30px;">
            This email was sent by GitHub Reaction Notifier.
          </p>
        </body>
      </html>
    `;
  }

  private buildTextBody(reactions: NewReaction[]): string {
    const lines = reactions.map(({ reaction, comment }) => {
      const emoji = REACTION_EMOJI[reaction.content];
      const preview = this.truncate(comment.body, 80);
      return `${emoji} ${reaction.user.login} reacted to: "${preview}"\n   ${comment.html_url}`;
    });

    return `New Reactions on Your Comments\n\n${lines.join("\n\n")}`;
  }

  private truncate(text: string, maxLength: number): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength - 3) + "...";
  }
}
