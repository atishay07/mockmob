# Learn v2 emulator walk helpers (APP-1101 section 7). Git Bash, from flutter_app:
#   source tool/walk_learn2.sh
#   l2_build pro returning      # builds and installs the demo for one variant (pro|free, returning|new)
#   l2_prep                     # adb reverse to the web dev preview on port 3452 (the demo's Learn v2 engine)
#   l2_theme day|night          # the phone's dark mode (the app follows Appearance; see l2_app_theme)
#   l2_launch                   # opens the demo app fresh
#   shot <name>; rec_start <name> <seconds>; rec_stop <name>; tapd "label regex"; sw ...; t x y s   (from emu_rec.sh)
# Stills and clips land in $REC_OUT (default: <repo>/tmp/learn-app-1101/walk). Never install the demo on the owner's phone
# unless he says it is connected; the demo is its own app id (in.mockmob.app.demo.debug).
export REC_OUT="${REC_OUT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/tmp/learn-app-1101/walk}"
mkdir -p "$REC_OUT"
source "$(dirname "${BASH_SOURCE[0]}")/emu_rec.sh"

L2_APP=in.mockmob.app.demo.debug

# l2_build <pro|free> <returning|new> [session name]: the demo with DEMO_PRO, DEMO_NEW and DEMO_LEARN_S, installed.
l2_build() {
  local plan="${1:-pro}" who="${2:-returning}" s="${3:-app-walk-$1-$2}"
  local defs=(--dart-define=DEMO_LEARN_S="$s")
  [ "$plan" = pro ] && defs+=(--dart-define=DEMO_PRO=true)
  [ "$who" = new ] && defs+=(--dart-define=DEMO_NEW=true --dart-define=DEMO_FRESH=true)
  bash tool/flutter_locked.sh build apk --debug -t test/device_demo/demo_main.dart "${defs[@]}" || return 1
  (cd android && ./gradlew --stop >/dev/null 2>&1)
  adb install -r build/app/outputs/flutter-apk/app-debug.apk
}

# The demo's Learn v2 calls go to http://localhost:3452 on the phone, which adb reverse carries to this PC's dev preview.
l2_prep() { adb reverse tcp:3452 tcp:3452; adb shell settings put global animator_duration_scale 1; }

# The phone's dark mode (for a demo set to follow the system).
l2_theme() { if [ "$1" = day ]; then adb shell cmd uimode night no; else adb shell cmd uimode night yes; fi; sleep 1; }

# Reduced motion on (1) or off (0): Android's animator scale, which the app reads as reduced motion.
l2_still() { if [ "$1" = 1 ]; then adb shell settings put global animator_duration_scale 0; else adb shell settings put global animator_duration_scale 1; fi; }

# Large text (1.3) or normal (1.0).
l2_font() { adb shell settings put system font_scale "${1:-1.0}"; }

l2_launch() { adb shell am force-stop "$L2_APP"; adb shell monkey -p "$L2_APP" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep "${1:-6}"; }

# Opens a website path in the demo as the App Link would (the ActionRouter maps it), e.g. l2_open "/learn/c/accountancy.admission-of-partner".
# The whole command goes to the device's shell as one quoted string: an unquoted "&" in a query would end the command there
# and drop -p, so another MockMob build on the phone would answer the link.
l2_open() { adb shell "am start -W -a android.intent.action.VIEW -d 'https://www.mockmob.in$1' -p $L2_APP" >/dev/null 2>&1; sleep "${2:-3}"; }
