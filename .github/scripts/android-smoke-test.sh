#!/usr/bin/env sh
set -eu

APK="apk/app-debug.apk"
PACKAGE="com.turbocharge.app"

test -s "$APK"
adb wait-for-device
adb logcat -c

echo "Installing APK..."
adb install -r "$APK"

echo "Launching Turbo Charge..."
adb shell monkey -p "$PACKAGE" 1
sleep 3

if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "FAIL: app process did not start."
  adb logcat -d -s AndroidRuntime:E
  exit 1
fi

echo "Checking app stability for 12 seconds..."
sleep 12

if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "FAIL: app process exited during stability check."
  adb logcat -d -s AndroidRuntime:E
  exit 1
fi

if adb logcat -d -s AndroidRuntime:E | grep -E "FATAL EXCEPTION|Process: $PACKAGE"; then
  echo "FAIL: Android runtime crash detected."
  exit 1
fi

echo "PASS: APK installed, app launched, and process remained alive without a detected runtime crash."
