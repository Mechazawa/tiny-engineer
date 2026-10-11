#include "settings/values.h"

#include "serial_log.h"
#include "servos.h"

SettingsValues g_settings = SettingsValues::defaults();
WifiNetworkList g_wifiNetworks;
char g_bootHostname[SETTINGS_HOSTNAME_MAX_LEN + 1] = {};

SettingsValues SettingsValues::defaults() {
  SettingsValues values{};

  values.sleepTimeoutMin = SETTINGS_DEFAULT_SLEEP_TIMEOUT_MIN;
  strlcpy(values.hostname, SETTINGS_DEFAULT_HOSTNAME, sizeof(values.hostname));
  values.volume = SETTINGS_DEFAULT_VOLUME;
  values.welcome = SETTINGS_DEFAULT_WELCOME;
  values.serialLog = SETTINGS_DEFAULT_SERIAL_LOG;
  values.continuousTimeoutMin = SETTINGS_DEFAULT_CONTINUOUS_TIMEOUT_MIN;
  strlcpy(values.loading, SETTINGS_DEFAULT_LOADING, sizeof(values.loading));
  strlcpy(values.eyesStyle, SETTINGS_DEFAULT_EYES_STYLE, sizeof(values.eyesStyle));
  strlcpy(values.accessToken, SETTINGS_DEFAULT_ACCESS_TOKEN, sizeof(values.accessToken));

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    values.servoRanges.mins[i] = static_cast<uint8_t>(SERVO_SPECS[i].min);
    values.servoRanges.maxs[i] = static_cast<uint8_t>(SERVO_SPECS[i].max);
  }

  strlcpy(values.rgbOrder, SETTINGS_DEFAULT_RGB_ORDER, sizeof(values.rgbOrder));
  values.oledRotate180 = SETTINGS_DEFAULT_OLED_ROTATE_180;
  return values;
}

void SettingsValues::apply(const SettingsPatch& patch) {
  sleepTimeoutMin = patch.sleepTimeoutMin.value_or(sleepTimeoutMin);
  volume = patch.volume.value_or(volume);
  welcome = patch.welcome.value_or(welcome);
  serialLog = patch.serialLog.value_or(serialLog);
  continuousTimeoutMin = patch.continuousTimeoutMin.value_or(continuousTimeoutMin);
  servoRanges = patch.servoRanges.value_or(servoRanges);
  oledRotate180 = patch.oledRotate180.value_or(oledRotate180);

  if (patch.hostname != nullptr) {
    strlcpy(hostname, patch.hostname, sizeof(hostname));
  }

  if (patch.loading != nullptr) {
    strlcpy(loading, patch.loading, sizeof(loading));
  }

  if (patch.eyesStyle != nullptr) {
    strlcpy(eyesStyle, patch.eyesStyle, sizeof(eyesStyle));
  }

  if (patch.accessToken != nullptr) {
    strlcpy(accessToken, patch.accessToken, sizeof(accessToken));
  }

  if (patch.rgbOrder != nullptr) {
    strlcpy(rgbOrder, patch.rgbOrder, sizeof(rgbOrder));
  }
}

void SettingsValues::log(const char* prefix) const {
  if (!serialLog) {
    return;
  }

  String line = prefix;

  line += String(" sleep_timeout=") + sleepTimeoutMin + "min";
  line += String(" hostname=") + hostname;
  line += String(" volume=") + volume;
  line += String(" welcome=") + (welcome ? "on" : "off");
  line += String(" serial_log=") + (serialLog ? "on" : "off");
  line += String(" continuous_timeout=") + continuousTimeoutMin + "min";
  line += String(" loading=") + loading;
  line += String(" eyes_style=") + eyesStyle;
  line += String(" access_token=") + (accessToken[0] != '\0' ? "set" : "unset");
  line += String(" wifi_networks=") + g_wifiNetworks.count();
  line += " servos=";

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    line += String(i > 0 ? ";" : "") + servoRanges.mins[i] + "-" + servoRanges.maxs[i];
  }

  line += String(" rgb_order=") + rgbOrder;
  line += String(" oled_rotate_180=") + (oledRotate180 ? "on" : "off");
  serialLogPrintln(line);
}
