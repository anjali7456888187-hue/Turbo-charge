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

echo "Checking visible app screen..."
UI_OK=0
ATTEMPT=1
while [ "$ATTEMPT" -le 5 ]; do
  sleep 2
  adb shell uiautomator dump /sdcard/turbo-charge-ui.xml >/dev/null 2>&1 || true
  if adb shell cat /sdcard/turbo-charge-ui.xml 2>/dev/null | grep -qi "Turbo Charge"; then
    UI_OK=1
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$UI_OK" -ne 1 ]; then
  echo "FAIL: Turbo Charge title was not found in the emulator UI."
  adb shell dumpsys activity activities | tail -n 80
  adb logcat -d -s AndroidRuntime:E chromium:E
  exit 1
fi
echo "PASS: Turbo Charge title is visible on the emulator screen."

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
