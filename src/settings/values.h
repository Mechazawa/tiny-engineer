#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>

#include "settings/settings.h"
#include "settings/wifi_network_list.h"

// Every saved setting except the WiFi networks, which have their own NVS key.
struct SettingsValues {
  uint32_t sleepTimeoutMin;
  char hostname[SETTINGS_HOSTNAME_MAX_LEN + 1];
  uint8_t volume;
  bool welcome;
  bool serialLog;
  uint32_t continuousTimeoutMin;
  char loading[SETTINGS_LOADING_MAX_LEN + 1];
  char eyesStyle[SETTINGS_EYES_STYLE_MAX_LEN + 1];
  char accessToken[SETTINGS_ACCESS_TOKEN_MAX_LEN + 1];
  ServoRanges servoRanges;
  char rgbOrder[SETTINGS_RGB_ORDER_MAX_LEN + 1];
  bool oledRotate180;

  static SettingsValues defaults();

  // The patch must be valid (SettingsPatch::invalidField() == nullptr).
  void apply(const SettingsPatch& patch);

  // Reads NVS over the current values; keys that are missing or invalid keep theirs.
  void load();

  // Writes every key. clearFirst also erases the rest of the namespace, WiFi networks included.
  bool save(bool clearFirst = false) const;

  void log(const char* prefix) const;
};

extern SettingsValues g_settings;
extern WifiNetworkList g_wifiNetworks;
extern char g_bootHostname[SETTINGS_HOSTNAME_MAX_LEN + 1];
