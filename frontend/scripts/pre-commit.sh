#!/usr/bin/env sh
set -e

cd frontend
npx lint-staged
pnpm run i18n:sync
