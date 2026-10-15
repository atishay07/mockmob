"""Writes lib/core/motion/motion_tokens.g.dart from shared/motion-tokens.json.

One motion language for the app and the website: the JSON at the repo root (shared/) is the
single source; the website has its own generator (scripts/gen-motion-tokens.mjs) for
src/app/motion-kit.css. `Motion` and `Springs` read their constants from the generated file, and
test/unit/motion/motion_tokens_test.dart holds the generated file to the JSON.

Usage, from flutter_app:
    python tool/gen_motion_tokens.py           # write the Dart file
    python tool/gen_motion_tokens.py --check   # exit 1 if the Dart file is stale
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SOURCE = APP.parent / "shared" / "motion-tokens.json"
TARGET = APP / "lib" / "core" / "motion" / "motion_tokens.g.dart"

IDENT = re.compile(r"^[a-z][A-Za-z0-9]*$")
FLUTTER_HAPTICS = {"selectionClick", "lightImpact", "mediumImpact", "heavyImpact"}


class TokenError(ValueError):
    pass


def fail(path: str, why: str) -> None:
    raise TokenError(f"{path}: {why}")


def is_number(v: object) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def num(v: float | int) -> str:
    """A Dart literal for a JSON number: ints stay ints (Dart widens them where a double is due)."""
    if isinstance(v, int):
        return str(v)
    text = repr(float(v))
    if "e" in text or "E" in text:
        text = f"{v:.10f}".rstrip("0").rstrip(".")
    return text


def cap(name: str) -> str:
    return name[:1].upper() + name[1:]


def ms(v: int) -> str:
    return f"Duration(milliseconds: {v})"


def check_name(path: str, name: str) -> None:
    if not IDENT.match(name):
        fail(path, f"'{name}' is not a lowerCamel identifier")


def validate(tokens: dict) -> None:
    for section in ("durations", "curves", "springs", "numbers", "counts", "transitions", "haptics"):
        if not isinstance(tokens.get(section), dict):
            fail(section, "missing or not an object")
    for name, v in tokens["durations"].items():
        check_name(f"durations.{name}", name)
        if not isinstance(v, int) or isinstance(v, bool) or v <= 0:
            fail(f"durations.{name}", "must be a positive whole number of milliseconds")
    for name, v in tokens["curves"].items():
        check_name(f"curves.{name}", name)
        if not (isinstance(v, list) and len(v) == 4 and all(is_number(x) for x in v)):
            fail(f"curves.{name}", "must be four numbers (a CSS cubic-bezier)")
        if not (0 <= v[0] <= 1 and 0 <= v[2] <= 1):
            fail(f"curves.{name}", "x1 and x2 must lie in 0..1")
    for name, v in tokens["springs"].items():
        check_name(f"springs.{name}", name)
        if not (isinstance(v, dict) and set(v) == {"ms", "bounce"}):
            fail(f"springs.{name}", "must be {ms, bounce}")
        if not isinstance(v["ms"], int) or v["ms"] <= 0:
            fail(f"springs.{name}.ms", "must be a positive whole number")
        if not (is_number(v["bounce"]) and -1 <= v["bounce"] <= 1):
            fail(f"springs.{name}.bounce", "must lie in -1..1")
    for name, v in tokens["numbers"].items():
        check_name(f"numbers.{name}", name)
        if not is_number(v):
            fail(f"numbers.{name}", "must be a number")
    for name, v in tokens["counts"].items():
        check_name(f"counts.{name}", name)
        if not isinstance(v, int) or isinstance(v, bool) or v < 0:
            fail(f"counts.{name}", "must be a whole number")
    curves = tokens["curves"]
    for group, values in tokens["transitions"].items():
        check_name(f"transitions.{group}", group)
        if not isinstance(values, dict):
            fail(f"transitions.{group}", "must be an object")
        for key, v in values.items():
            path = f"transitions.{group}.{key}"
            check_name(path, key)
            if key.endswith("Ms"):
                if not isinstance(v, int) or v <= 0:
                    fail(path, "must be a positive whole number of milliseconds")
            elif key == "curve" or key.endswith("Curve"):
                if v not in curves:
                    fail(path, f"names no curve in 'curves' ({v})")
            elif not is_number(v):
                fail(path, "must be a number")
    haptics = tokens["haptics"]
    for name, v in haptics.get("base", {}).items():
        check_name(f"haptics.base.{name}", name)
        check_sequence(f"haptics.base.{name}.flutter", v.get("flutter"))
        check_web(f"haptics.base.{name}.web", v.get("web"))
    for name, v in haptics.get("verbs", {}).items():
        check_name(f"haptics.verbs.{name}", name)
        if not re.match(r"^[A-Z_]+$", str(v.get("android", ""))):
            fail(f"haptics.verbs.{name}.android", "must name a HapticFeedbackConstants field")
        if not isinstance(v.get("minApi"), int):
            fail(f"haptics.verbs.{name}.minApi", "must be an Android API level")
        check_sequence(f"haptics.verbs.{name}.fallback", v.get("fallback"))
        check_web(f"haptics.verbs.{name}.web", v.get("web"))


def check_sequence(path: str, seq: object) -> None:
    """A Flutter haptic sequence: calls, with whole-millisecond gaps between them."""
    if not isinstance(seq, list):
        fail(path, "must be a list")
    gaps = [x for x in seq if isinstance(x, int)]
    calls = [x for x in seq if isinstance(x, str)]
    if len(gaps) + len(calls) != len(seq) or any(c not in FLUTTER_HAPTICS for c in calls):
        fail(path, f"must hold {sorted(FLUTTER_HAPTICS)} calls and millisecond gaps")
    if len(gaps) > 1:
        fail(path, "at most one gap (the Dart side has one gap token per sequence)")


def check_web(path: str, seq: object) -> None:
    if not (isinstance(seq, list) and all(isinstance(x, int) and x >= 0 for x in seq)):
        fail(path, "must be a navigator.vibrate pattern (whole milliseconds)")


def generate(tokens: dict) -> str:
    validate(tokens)
    out: list[str] = []
    table: list[tuple[str, str]] = []
    w = out.append

    w("// GENERATED by tool/gen_motion_tokens.py from shared/motion-tokens.json. Do not edit by hand:")
    w("// change the JSON (the website reads the same file) and run `python tool/gen_motion_tokens.py`.")
    w("// test/unit/motion/motion_tokens_test.dart fails when this file and the JSON disagree.")
    w("")
    w("import 'package:flutter/animation.dart';")
    w("")
    w(f"/// The version of shared/motion-tokens.json this file was generated from.")
    w(f"const int motionTokensVersion = {int(tokens.get('version', 0))};")
    w("")

    w("/// Durations (`durations`, milliseconds).")
    w("abstract final class MotionDurations {")
    for name, v in tokens["durations"].items():
        w(f"  static const Duration {name} = {ms(v)};")
        table.append((f"durations.{name}", f"MotionDurations.{name}"))
    w("}")
    w("")

    w("/// Curves (`curves`, the four control values of a CSS cubic-bezier).")
    w("abstract final class MotionCurves {")
    for name, v in tokens["curves"].items():
        w(f"  static const Cubic {name} = Cubic({', '.join(num(x) for x in v)});")
        table.append((f"curves.{name}", f"MotionCurves.{name}"))
    w("}")
    w("")

    w("/// Springs (`springs`): a settle duration and a bounce, for")
    w("/// `SpringDescription.withDurationAndBounce` (built in `Springs`).")
    w("abstract final class MotionSprings {")
    for name, v in tokens["springs"].items():
        w(f"  static const Duration {name}Duration = {ms(v['ms'])};")
        w(f"  static const double {name}Bounce = {num(v['bounce'])};")
        table.append((f"springs.{name}.ms", f"MotionSprings.{name}Duration"))
        table.append((f"springs.{name}.bounce", f"MotionSprings.{name}Bounce"))
    w("}")
    w("")

    w("/// Distances, scales and shares (`numbers`) and whole counts (`counts`).")
    w("abstract final class MotionNumbers {")
    for name, v in tokens["numbers"].items():
        w(f"  static const double {name} = {num(v)};")
        table.append((f"numbers.{name}", f"MotionNumbers.{name}"))
    for name, v in tokens["counts"].items():
        w(f"  static const int {name} = {v};")
        table.append((f"counts.{name}", f"MotionNumbers.{name}"))
    w("}")
    w("")

    w("/// Page and sheet transitions (`transitions`), as the app's router draws them; the website")
    w("/// draws its view transitions from the same values.")
    w("abstract final class MotionTransitions {")
    for group, values in tokens["transitions"].items():
        for key, v in values.items():
            path = f"transitions.{group}.{key}"
            if key.endswith("Ms"):
                name = group + cap(key[:-2])
                w(f"  static const Duration {name} = {ms(v)};")
            elif key == "curve" or key.endswith("Curve"):
                name = group + cap(key)
                w(f"  static const Cubic {name} = MotionCurves.{v};")
            else:
                name = group + cap(key)
                w(f"  static const double {name} = {num(v)};")
            table.append((path, f"MotionTransitions.{name}"))
    w("}")
    w("")

    w("/// The gaps inside the haptic sequences (`haptics`); the verbs themselves live in")
    w("/// `lib/core/haptics/haptics.dart` and the Android side in `HapticsChannel.kt`.")
    w("abstract final class MotionHaptics {")
    haptics = tokens["haptics"]
    for name, v in haptics.get("base", {}).items():
        for x in v["flutter"]:
            if isinstance(x, int):
                w(f"  static const Duration {name}Gap = {ms(x)};")
                table.append((f"haptics.base.{name}.flutter", f"MotionHaptics.{name}Gap"))
    for name, v in haptics.get("verbs", {}).items():
        for x in v["fallback"]:
            if isinstance(x, int):
                w(f"  static const Duration {name}FallbackGap = {ms(x)};")
                table.append((f"haptics.verbs.{name}.fallback", f"MotionHaptics.{name}FallbackGap"))
    w("}")
    w("")

    w("/// Every generated value by its JSON path, so the test can hold this file to the JSON.")
    w("const Map<String, Object> motionTokenTable = <String, Object>{")
    for path, ref in table:
        w(f"  '{path}': {ref},")
    w("};")
    return "\n".join(out) + "\n"


def main(argv: list[str]) -> int:
    check = "--check" in argv
    tokens = json.loads(SOURCE.read_text(encoding="utf-8"))
    try:
        text = generate(tokens)
    except TokenError as e:
        print(f"motion-tokens.json is invalid: {e}", file=sys.stderr)
        return 2
    current = TARGET.read_text(encoding="utf-8") if TARGET.exists() else None
    if check:
        if current != text:
            print(f"{TARGET.relative_to(APP)} is stale; run python tool/gen_motion_tokens.py", file=sys.stderr)
            return 1
        print("motion tokens are up to date")
        return 0
    if current != text:
        TARGET.write_bytes(text.encode("utf-8"))
        print(f"wrote {TARGET.relative_to(APP)}")
    else:
        print("motion tokens already up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
