#!/usr/bin/env bash
# Runs heavy Flutter commands with at most MOCKMOB_FLUTTER_SLOTS (default 2) at a time across
# parallel agents on this 16 GB PC.
# Usage (from flutter_app): bash tool/flutter_locked.sh test -j 1 test/unit/today
#                           bash tool/flutter_locked.sh analyze lib/features/today
# Each slot is a directory (mkdir is atomic); a slot whose holder has died is taken over.
set -u
cd "$(dirname "$0")/.."
source tool/android_env.sh
SLOTS="${MOCKMOB_FLUTTER_SLOTS:-2}"
BASE="${TMP:-/tmp}/mockmob-flutter.lock"
waited=0
LOCK=""
while [ -z "$LOCK" ]; do
  for n in $(seq 1 "$SLOTS"); do
    candidate="$BASE.$n"
    if mkdir "$candidate" 2>/dev/null; then LOCK="$candidate"; break; fi
    holder=$(cat "$candidate/pid" 2>/dev/null || echo "")
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$candidate"; fi
  done
  [ -n "$LOCK" ] && break
  if [ $((waited % 60)) -eq 0 ]; then echo "waiting for a Flutter slot (${waited}s)" >&2; fi
  sleep 5; waited=$((waited + 5))
  if [ "$waited" -ge 2400 ]; then echo "slot wait over 40 minutes; taking slot 1" >&2; rm -rf "$BASE.1"; fi
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM
flutter "$@"
