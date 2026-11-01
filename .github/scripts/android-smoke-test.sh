#!/usr/bin/env sh
set -eu

APK="${APK_PATH:-apk/Turbo Charge.apk}"
PACKAGE="${PACKAGE_ID:-com.turbocharge.app}"

test -s "$APK"
adb wait-for-device
adb logcat -c

echo "Installing APK..."
timeout 90 adb install -r "$APK"

echo "Launching Turbo Charge..."
# Cold emulator startup can make monkey slow; allow enough time for Android to dispatch the launch.
timeout 60 adb shell monkey -p "$PACKAGE" 1

echo "Checking that Turbo Charge is the foreground activity..."
FOREGROUND_OK=0
ATTEMPT=1
while [ "$ATTEMPT" -le 10 ]; do
  sleep 3
  ACTIVITY_DUMP="$(timeout 15 adb shell dumpsys activity activities 2>/dev/null || true)"
  WINDOW_DUMP="$(timeout 15 adb shell dumpsys window windows 2>/dev/null || true)"
  if printf '%s' "$ACTIVITY_DUMP" | grep -F "$PACKAGE" >/dev/null; then
    if printf '%s' "$WINDOW_DUMP" | grep -F "$PACKAGE" >/dev/null; then
      FOREGROUND_OK=1
      break
    fi
  fi
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$FOREGROUND_OK" -ne 1 ]; then
  echo "FAIL: Turbo Charge did not become the foreground app."
  timeout 20 adb shell dumpsys activity activities | tail -n 100 || true
  adb logcat -d -s AndroidRuntime:E chromium:E
  exit 1
fi
echo "PASS: Turbo Charge activity and app window are present."

if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "FAIL: app process did not start."
  adb logcat -d -s AndroidRuntime:E
  exit 1
fi

echo "Checking app stability for 15 seconds..."
sleep 15

if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "FAIL: app process exited during stability check."
  adb logcat -d -s AndroidRuntime:E
  exit 1
fi

if adb logcat -d -s AndroidRuntime:E | grep -E "FATAL EXCEPTION|Process: $PACKAGE"; then
  echo "FAIL: Android runtime crash detected."
  exit 1
fi

echo "PASS: APK installed, launched, foregrounded, and remained alive without a detected Android runtime crash."
