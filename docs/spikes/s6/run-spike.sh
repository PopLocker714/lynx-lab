#!/bin/sh
# Прогон спайка: ./run-spike.sh <mode> <label> [apk]
# Сохраняет logcat в spike-logs/<label>-<mode>.log
set -e
MODE=${1:-predraw}; LABEL=${2:-run}; APK=${3:-}
mkdir -p spike-logs
OUT=spike-logs/$LABEL-$MODE.log
if [ -n "$APK" ]; then adb install -r -d "$APK" >/dev/null; fi
adb shell am force-stop com.probe.e2e
adb shell setprop debug.spike.mode "$MODE"
adb logcat -c
adb shell am start -W -n com.probe.e2e/.SplashActivity >/dev/null
sleep 7
adb logcat -d -v threadtime > "$OUT.full"
grep -E 'SPIKE|lynx.onRuntime|E/lynx|LynxError|GlobalProps' "$OUT.full" | grep -v 'D/SPIKE' > "$OUT" || true
echo "== $OUT ($(wc -l < "$OUT") lines) =="
cat "$OUT"
