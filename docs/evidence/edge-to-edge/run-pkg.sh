#!/bin/sh
# Прогон пакета на устройстве: ./run-pkg.sh <label> [apk] [scenario]
# scenario: cold (default) | rotate | threebutton | background
set -e
LABEL=${1:-run}; APK=${2:-}; SCENARIO=${3:-cold}
mkdir -p spike-logs
OUT=spike-logs/pkg-$LABEL.log
if [ -n "$APK" ]; then adb install -r -d "$APK" >/dev/null; fi
adb shell am force-stop com.probe.e2e
adb logcat -c
adb shell am start -W -n com.probe.e2e/.SplashActivity >/dev/null
sleep 4
case "$SCENARIO" in
  rotate)
    adb shell settings put system accelerometer_rotation 0
    adb shell settings put system user_rotation 1; sleep 3
    adb exec-out screencap -p > "spike-logs/pkg-$LABEL-landscape.png"
    adb shell settings put system user_rotation 0; sleep 3 ;;
  threebutton)
    adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton; sleep 3
    adb exec-out screencap -p > "spike-logs/pkg-$LABEL-threebutton.png"
    adb shell cmd overlay disable com.android.internal.systemui.navbar.threebutton; sleep 3 ;;
  background)
    adb shell input keyevent KEYCODE_HOME; sleep 2
    adb shell am start -n com.probe.e2e/.SplashActivity >/dev/null 2>&1 || adb shell monkey -p com.probe.e2e 1 >/dev/null 2>&1; sleep 3 ;;
esac
adb exec-out screencap -p > "spike-logs/pkg-$LABEL.png"
adb logcat -d -v threadtime > "$OUT.full"
grep -E 'SPIKE|LynxEdgeToEdge|E/lynx|LynxError|GlobalProps|Skip unavailable' "$OUT.full" | sed -E 's/wall=[0-9]+ //' | cut -c1-330 > "$OUT" || true
echo "== $OUT ($(wc -l < "$OUT") lines) =="
cat "$OUT"
