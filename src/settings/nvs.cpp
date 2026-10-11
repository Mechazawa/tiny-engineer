#include "settings/nvs.h"

#include "serial_log.h"
#include "settings/values.h"

Preferences g_settingsPrefs;

namespace {

// Stored as min,max pairs, one per servo.
constexpr size_t kServoRangesLen = SETTINGS_SERVO_COUNT * 2;

template <size_t N>
void loadText(char (&dest)[N], const char* key, bool (*valid)(const char*)) {
  const String value = g_settingsPrefs.getString(key, dest);

  if (valid(value.c_str())) {
    copyText(dest, value.c_str());
  }
}

void loadMinutes(uint32_t& dest, const char* key, bool (*valid)(uint32_t)) {
  const uint32_t value = g_settingsPrefs.getUInt(key, dest);

  if (valid(value)) {
    dest = value;
  }
}

}  // namespace

bool settingsNvsBeginRead() {
  return g_settingsPrefs.begin(kNs, true);
}

bool settingsNvsBeginWrite() {
  return g_settingsPrefs.begin(kNs, false);
}

void settingsNvsEnd() {
  g_settingsPrefs.end();
}

void SettingsValues::load() {
  loadMinutes(sleepTimeoutMin, kKeySleep, settingsValidateSleepTimeout);
  loadText(hostname, kKeyHost, settingsValidateHostname);

  const uint32_t storedVolume = g_settingsPrefs.getUInt(kKeyVolume, volume);

  if (storedVolume <= SETTINGS_VOLUME_MAX) {
    volume = static_cast<uint8_t>(storedVolume);
  }

  welcome = g_settingsPrefs.getBool(kKeyWelcome, welcome);
  serialLog = g_settingsPrefs.getBool(kKeySerialLog, serialLog);
  loadMinutes(continuousTimeoutMin, kKeyContTo, settingsValidateContinuousTimeout);
  loadText(loading, kKeyLoading, settingsValidateLoading);
  loadText(eyesStyle, kKeyEyesStyle, settingsValidateEyesStyle);
  loadText(accessToken, kKeyAccessTok, settingsValidateAccessToken);

  uint8_t blob[kServoRangesLen] = {};

  if (g_settingsPrefs.getBytes(kKeyServoRanges, blob, kServoRangesLen) == kServoRangesLen) {
    ServoRanges stored{};

    for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
      stored.mins[i] = blob[i * 2];
      stored.maxs[i] = blob[i * 2 + 1];
    }

    if (stored.valid()) {
      servoRanges = stored;
    }
  }

  loadText(rgbOrder, kKeyRgbOrder, settingsValidateRgbOrder);
  oledRotate180 = g_settingsPrefs.getBool(kKeyOledRot, oledRotate180);
}

bool SettingsValues::save(bool clearFirst) const {
  if (!settingsNvsBeginWrite()) {
    serialLogPrintln("Settings: NVS write open failed");
    return false;
  }

  if (clearFirst) {
    g_settingsPrefs.clear();
  }

  uint8_t blob[kServoRangesLen];

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    blob[i * 2] = servoRanges.mins[i];
    blob[i * 2 + 1] = servoRanges.maxs[i];
  }

  g_settingsPrefs.putUInt(kKeySleep, sleepTimeoutMin);
  g_settingsPrefs.putString(kKeyHost, hostname);
  g_settingsPrefs.putUInt(kKeyVolume, volume);
  g_settingsPrefs.putBool(kKeyWelcome, welcome);
  g_settingsPrefs.putBool(kKeySerialLog, serialLog);
  g_settingsPrefs.putUInt(kKeyContTo, continuousTimeoutMin);
  g_settingsPrefs.putString(kKeyLoading, loading);
  g_settingsPrefs.putString(kKeyEyesStyle, eyesStyle);
  g_settingsPrefs.putString(kKeyAccessTok, accessToken);
  g_settingsPrefs.putBytes(kKeyServoRanges, blob, kServoRangesLen);
  g_settingsPrefs.putString(kKeyRgbOrder, rgbOrder);
  g_settingsPrefs.putBool(kKeyOledRot, oledRotate180);
  settingsNvsEnd();
  return true;
}

bool saveSettings(const SettingsPatch& patch, bool* rebootRequired) {
  if (rebootRequired != nullptr) {
    *rebootRequired = false;
  }

  if (patch.invalidField() != nullptr) {
    return false;
  }

  SettingsValues next = g_settings;
  next.apply(patch);

  if (!next.save()) {
    return false;
  }

  g_settings = next;

  if (rebootRequired != nullptr) {
    *rebootRequired = strcmp(g_settings.hostname, g_bootHostname) != 0;
  }

  g_settings.log("Settings saved:");
  return true;
}

bool saveWifiNetworks(const WifiNetworkList& networks) {
  if (!settingsNvsBeginWrite()) {
    serialLogPrintln("Settings: NVS write open failed");
    return false;
  }

  const size_t length = networks.count() * sizeof(WifiNetwork);
  const bool written =
    g_settingsPrefs.putBytes(kKeyWifiNets, networks.data(), length) == length;

  settingsNvsEnd();

  if (!written) {
    serialLogPrintln("Settings: WiFi networks write failed");
    return false;
  }

  g_wifiNetworks = networks;
  g_settings.log("Settings saved:");
  return true;
}

bool factoryResetSettings(bool* rebootRequired) {
  const SettingsValues defaults = SettingsValues::defaults();

  if (rebootRequired != nullptr) {
    *rebootRequired = strcmp(g_bootHostname, defaults.hostname) != 0 ||
                      strcmp(g_settings.loading, defaults.loading) != 0 ||
                      g_wifiNetworks.count() > 0;
  }

  // The hardware calibration survives a reset.
  SettingsValues next = defaults;
  next.servoRanges = g_settings.servoRanges;
  copyText(next.rgbOrder, g_settings.rgbOrder);
  next.oledRotate180 = g_settings.oledRotate180;

  if (!next.save(true)) {
    serialLogPrintln("Settings: factory reset NVS open failed");
    return false;
  }

  g_settings = next;
  g_wifiNetworks.clear();
  g_settings.log("Settings factory reset:");
  return true;
}
