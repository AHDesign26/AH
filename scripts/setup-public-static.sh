#!/usr/bin/env bash
# Create the symlink public/static -> ../static so Astro serves the existing
# Flask static assets at the same /static/* URLs.
#
# Idempotent. Run once per fresh clone on Linux/macOS. Windows users run
# setup-public-static.ps1 instead (junction, not symlink).

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
public_dir="$repo_root/public"
link_path="$public_dir/static"
target_path="$repo_root/static"

if [[ ! -d "$target_path" ]]; then
  echo "static/ does not exist at $target_path; nothing to link." >&2
  exit 1
fi

mkdir -p "$public_dir"

if [[ -L "$link_path" || -d "$link_path" ]]; then
  echo "public/static already exists at $link_path"
  exit 0
fi

ln -s ../static "$link_path"
echo "Created symlink public/static -> ../static"
