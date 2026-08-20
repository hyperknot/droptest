#!/bin/sh
set -eu

cd "$(dirname "$0")/fe"
pnpm build
pnpm exec wrangler deploy
