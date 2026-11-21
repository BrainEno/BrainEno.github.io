#!/usr/bin/env bash
# Run on a disposable English-language Android emulator, with the demo API on port 4000.
set -euo pipefail
apk=${1:?Pass the flutter-blog debug APK}
out=${2:?Pass an output directory}
mkdir -p "$out"
adb shell wm size 864x1728
adb shell wm density 320
adb shell settings put system font_scale 1.0
adb shell cmd uimode night no
adb shell input keyevent 82
adb install -r "$apk"
pkg=com.nodeman24.nowave
adb shell monkey -p "$pkg" 1
sleep 14
adb exec-out screencap -p > "$out/feed.png"
adb shell screenrecord --time-limit 18 --bit-rate 2000000 /sdcard/showcase.mp4 &
recorder=$!
sleep 2
adb shell input swipe 425 1230 425 560 800
sleep 2
adb exec-out screencap -p > "$out/index.png"
adb shell am start -a android.intent.action.VIEW -d nowave://article/notes-on-moving-water "$pkg"
sleep 4
adb exec-out screencap -p > "$out/reader.png"
adb shell input swipe 425 1230 425 670 700
wait "$recorder"
adb pull /sdcard/showcase.mp4 "$out/walkthrough.mp4"
