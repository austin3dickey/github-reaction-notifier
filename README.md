# GitHub Reaction Notifier

Shows reactions to your GitHub activity in the macOS menu bar. GitHub doesn't notify you about reactions, so this does.

## How it works

[SwiftBar](https://swiftbar.app/) runs the plugin every 5 minutes while your Mac is awake. Each run sends one GraphQL query for your recent items and the reactions on them:

- Your last 100 issue and pull request comments
- Your last 50 issues and 50 pull requests
- Your last 50 pull request reviews and their review comments
- Your last 20 commit comments
- Your last 20 discussions and 50 discussion comments

New reactions from other people go in the menu. The menu bar shows how many are unread. Click a reaction to open it on GitHub. Click **Mark all as read** to clear the list.

The query costs about 19 points of the 5,000-point hourly GraphQL rate limit.

State is in `~/.local/state/github-reaction-notifier/state.json` (or `$XDG_STATE_HOME/github-reaction-notifier/state.json`). On the first run, the plugin marks all current reactions as seen, so it doesn't show your whole history. To start over, delete the file.

## Setup

Requirements: Node 24 or later, the [GitHub CLI](https://cli.github.com/) logged in with `gh auth login`, and SwiftBar.

```bash
brew install --cask swiftbar
mkdir -p ~/.config/swiftbar
ln -s "$PWD/plugin/github-reactions.5m.sh" ~/.config/swiftbar/
defaults write com.ameba.SwiftBar PluginDirectory "$HOME/.config/swiftbar"
open -a SwiftBar
```

The plugin gets a token from `gh auth token`. To use a different token, set `GITHUB_TOKEN`. With access to private repos, the token also covers your activity there.

SwiftBar runs plugins with a minimal `PATH`. The plugin adds the fnm default Node, `/opt/homebrew/bin`, and `/usr/local/bin`. If Node or `gh` is somewhere else, edit `PATH` in `plugin/github-reactions.5m.sh`.

To change how often it checks, rename the symlink, for example to `github-reactions.15m.sh`.

## Development

```bash
npm install --ignore-scripts
npm test            # node:test, runs the TypeScript directly
npm run typecheck
npm run lint
npm run format
npm start           # prints the SwiftBar menu (needs GITHUB_TOKEN)
```
