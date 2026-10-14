# Emulator journey recording helpers (Git Bash). Usage: source tool/emu_rec.sh; rec_start name 90; tapd "^Start" 1.5; t x y sleep; sw x1 y1 x2 y2 ms sleep; back 1; shot name; labels; rec_stop name
# Clips land in $REC_OUT (default: <repo>/tmp/rec). Frames: python tool/frame_sheet.py clip.mp4 out.png start end fps [width] [cols] [crop w:h:x:y] (needs: python -m pip install --user --use-feature=truststore imageio-ffmpeg pillow)
export MSYS_NO_PATHCONV=1
source "$(dirname "${BASH_SOURCE[0]}")/android_env.sh"
OUT="${REC_OUT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/tmp/rec}"
mkdir -p "$OUT"
t(){ adb shell input tap $1 $2; sleep $3; }
sw(){ adb shell input swipe $1 $2 $3 $4 $5; sleep $6; }
back(){ adb shell input keyevent 4; sleep $1; }
rec_start(){ adb shell rm -f /sdcard/$1.mp4; adb shell screenrecord --bit-rate 8000000 --time-limit $2 /sdcard/$1.mp4 </dev/null >/dev/null 2>&1 & REC_PID=$!; sleep 1.5; }
rec_stop(){ adb shell pkill -2 screenrecord; wait $REC_PID 2>/dev/null; sleep 2; adb pull /sdcard/$1.mp4 "$(cygpath -m "$OUT")/$1.mp4" >/dev/null 2>&1; ls -la "$OUT/$1.mp4"; }
shot(){ adb exec-out screencap -p > "$OUT/$1.png"; }
# tapd "label regex" [sleep]: tap the first node whose content-desc or text matches
UIPY='
import sys,re,html
x=sys.stdin.read()
pat=re.compile(sys.argv[2]) if len(sys.argv)>2 else None
for n in re.finditer(r"<node [^>]*>",x):
    a=n.group(0)
    t=" ".join(html.unescape(v) for v in re.findall(r"(?:text|content-desc)=\"([^\"]*)\"",a) if v.strip()).replace(chr(10)," / ")
    b=re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"",a)
    if not t or not b: continue
    xy=((int(b.group(1))+int(b.group(3)))//2,(int(b.group(2))+int(b.group(4)))//2)
    if sys.argv[1]=="list": print(repr(t[:70]),*xy)
    elif pat.search(t): print(*xy); break
'
tapd(){ adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; local xy; xy=$(adb shell cat /sdcard/ui.xml | python -c "$UIPY" find "$1"); if [ -z "$xy" ]; then echo "NOT FOUND: $1"; return 1; fi; adb shell input tap $xy; sleep ${2:-1.2}; }
labels(){ adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml | python -c "$UIPY" list; }
