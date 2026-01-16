# GitHub Reaction Email Notifier

Get email notifications when someone reacts to your GitHub comments.

## How It Works

A GitHub Action runs every 15 minutes and:
1. Fetches your recent comments across all public repositories
2. Checks each comment for reactions
3. Sends you an email for any new reactions
4. Tracks which reactions you've already been notified about

## Setup

### 1. Create a Personal Access Token

1. Go to https://github.com/settings/tokens
2. Generate a new token (classic) with `public_repo` scope
3. Copy the token for the next step

### 2. Add Repository Secrets

Go to your repo's **Settings → Secrets and variables → Actions** and add:

| Secret | Description | Example |
|--------|-------------|---------|
| `GH_PAT` | Personal Access Token from step 2 | `ghp_xxxx...` |
| `GH_USERNAME` | Your GitHub username | `octocat` |
| `SMTP_HOST` | Your email provider's SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username (usually your email) | `you@gmail.com` |
| `SMTP_PASSWORD` | SMTP password or app password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_FROM` | Sender email address | `you@gmail.com` |
| `EMAIL_TO` | Where to receive notifications | `you@gmail.com` |

#### Gmail Setup

If using Gmail:
1. Enable 2-factor authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an app password for "Mail"
4. Use that 16-character password as `SMTP_PASSWORD`

### 3. Test the Workflow

1. Go to **Actions** tab in your repository
2. Click **Check Reactions** workflow
3. Click **Run workflow**
4. Check the workflow logs and your email

## Configuration

Edit `.github/workflows/check-reactions.yml` to change the schedule:

```yaml
schedule:
  # Every 15 minutes (default)
  - cron: "*/15 * * * *"

  # Every hour
  - cron: "0 * * * *"

  # Every 6 hours
  - cron: "0 */6 * * *"
```

## Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run (requires environment variables)
GITHUB_TOKEN=xxx GITHUB_USERNAME=xxx ... npm start
```

## Limitations

- Only monitors public repositories (private repos require additional token permissions)
- GitHub Events API only returns ~90 days of activity
- Rate limited to 5000 API requests/hour (more than sufficient for this use case)
