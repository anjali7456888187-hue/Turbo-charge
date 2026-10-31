#!/usr/bin/env sh
set -eu

APK="apk/app-debug.apk"
PACKAGE="com.turbocharge.app"

test -s "$APK"
adb logcat -c
adb install "$APK"
adb shell monkey -p "$PACKAGE" 1
sleep 12

if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "FAIL: Turbo Charge process is not running after launch."
  adb logcat -d -s AndroidRuntime:E
  exit 1
fi

if adb logcat -d -s AndroidRuntime:E | grep -E "FATAL EXCEPTION|Process: $PACKAGE"; then
  echo "FAIL: Android runtime crash detected."
  exit 1
fi

echo "PASS: Turbo Charge installed and remained running in the Android emulator."
