#!/usr/bin/env bash
# <swiftbar.title>GitHub Reactions</swiftbar.title>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
set -euo pipefail

# SwiftBar runs plugins with a minimal PATH. Add the usual node and gh locations.
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

repo_dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN="$(gh auth token)"
  export GITHUB_TOKEN
fi

exec node "$repo_dir/src/index.ts" "$@"
