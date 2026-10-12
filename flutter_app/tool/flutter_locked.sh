#!/usr/bin/env bash
# Runs one heavy Flutter command at a time across parallel agents on this 16 GB PC.
# Usage (from flutter_app): bash tool/flutter_locked.sh test -j 1 test/unit/today
#                           bash tool/flutter_locked.sh analyze lib/features/today
# The lock is a directory (mkdir is atomic); a lock whose holder has died is taken over.
set -u
cd "$(dirname "$0")/.."
source tool/android_env.sh
LOCK="${TMP:-/tmp}/mockmob-flutter.lock"
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  holder=$(cat "$LOCK/pid" 2>/dev/null || echo "")
  if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
    rm -rf "$LOCK"; continue
  fi
  if [ $((waited % 60)) -eq 0 ]; then echo "waiting for the Flutter lock (held by ${holder:-unknown}, ${waited}s)" >&2; fi
  sleep 5; waited=$((waited + 5))
  if [ "$waited" -ge 2400 ]; then echo "lock wait over 40 minutes; taking it" >&2; rm -rf "$LOCK"; fi
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM
flutter "$@"
