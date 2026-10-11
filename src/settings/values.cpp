#include "settings/values.h"

#include "serial_log.h"
#include "servos.h"

SettingsValues g_settings = SettingsValues::defaults();
WifiNetworkList g_wifiNetworks;
char g_bootHostname[SETTINGS_HOSTNAME_MAX_LEN + 1] = {};

SettingsValues SettingsValues::defaults() {
  SettingsValues values{};

  values.sleepTimeoutMin = SETTINGS_DEFAULT_SLEEP_TIMEOUT_MIN;
  copyText(values.hostname, SETTINGS_DEFAULT_HOSTNAME);
  values.volume = SETTINGS_DEFAULT_VOLUME;
  values.welcome = SETTINGS_DEFAULT_WELCOME;
  values.serialLog = SETTINGS_DEFAULT_SERIAL_LOG;
  values.continuousTimeoutMin = SETTINGS_DEFAULT_CONTINUOUS_TIMEOUT_MIN;
  copyText(values.loading, SETTINGS_DEFAULT_LOADING);
  copyText(values.eyesStyle, SETTINGS_DEFAULT_EYES_STYLE);
  copyText(values.accessToken, SETTINGS_DEFAULT_ACCESS_TOKEN);

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    values.servoRanges.mins[i] = static_cast<uint8_t>(SERVO_SPECS[i].min);
    values.servoRanges.maxs[i] = static_cast<uint8_t>(SERVO_SPECS[i].max);
  }

  copyText(values.rgbOrder, SETTINGS_DEFAULT_RGB_ORDER);
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
    copyText(hostname, patch.hostname);
  }

  if (patch.loading != nullptr) {
    copyText(loading, patch.loading);
  }

  if (patch.eyesStyle != nullptr) {
    copyText(eyesStyle, patch.eyesStyle);
  }

  if (patch.accessToken != nullptr) {
    copyText(accessToken, patch.accessToken);
  }

  if (patch.rgbOrder != nullptr) {
    copyText(rgbOrder, patch.rgbOrder);
  }
}

void SettingsValues::log(const char* prefix) const {
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
