#!/usr/bin/env python3
"""Bumps the Play versionCode (and optionally the versionName) in pubspec.yaml.

Flutter turns `version: 1.0.0+7` into versionName 1.0.0 and versionCode 7
(android/app/build.gradle.kts reads flutter.versionName and flutter.versionCode).
Play rejects an upload whose versionCode is not higher than every earlier upload,
so run this before every upload.

Run from flutter_app (no packages needed):
    python -I tool/bump_version.py            # 1.0.0+1  ->  1.0.0+2
    python -I tool/bump_version.py --name 1.1.0   # 1.0.0+2  ->  1.1.0+3 (the code always goes up by one)
    python -I tool/bump_version.py --dry-run  # print, change nothing
    python -I tool/bump_version.py --show     # print the current version

It edits only the `version:` line and prints the old and the new value.
"""
import argparse
import re
import sys
from pathlib import Path

PUBSPEC = Path(__file__).resolve().parent.parent / "pubspec.yaml"
LINE = re.compile(r"^version:\s*(\d+)\.(\d+)\.(\d+)\+(\d+)\s*$", re.MULTILINE)
NAME = re.compile(r"^\d+\.\d+\.\d+$")
MAX_CODE = 2_100_000_000  # Play's ceiling for versionCode


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", help="new versionName, for example 1.1.0 (default: keep it)")
    ap.add_argument("--dry-run", action="store_true", help="show the change without writing it")
    ap.add_argument("--show", action="store_true", help="print the current version and exit")
    args = ap.parse_args()

    text = PUBSPEC.read_text(encoding="utf-8")
    m = LINE.search(text)
    if not m:
        print("pubspec.yaml has no line like 'version: 1.0.0+1'", file=sys.stderr)
        return 1
    major, minor, patch, code = (int(g) for g in m.groups())
    old = f"{major}.{minor}.{patch}+{code}"
    if args.show:
        print(old)
        return 0

    name = f"{major}.{minor}.{patch}"
    if args.name:
        if not NAME.match(args.name):
            print("--name must look like 1.2.3", file=sys.stderr)
            return 1
        name = args.name
    new_code = code + 1
    if new_code > MAX_CODE:
        print("versionCode would pass Play's limit", file=sys.stderr)
        return 1
    new = f"{name}+{new_code}"
    print(f"version: {old} -> {new}")
    if not args.dry_run:
        PUBSPEC.write_text(LINE.sub(f"version: {new}", text, count=1), encoding="utf-8", newline="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
