#pragma once

#include <cstddef>

#include "settings/settings.h"

struct WifiNetwork {
  char ssid[SETTINGS_WIFI_SSID_MAX_LEN + 1];
  char password[SETTINGS_WIFI_PASSWORD_MAX_LEN + 1];
};

// Saved networks in the order the robot tries them at boot.
class WifiNetworkList {
public:
  size_t count() const;
  const WifiNetwork& at(size_t index) const;
  const WifiNetwork* data() const;
  int find(const char* ssid) const;

  // Puts the network first, replacing the password when the SSID is already
  // saved. False when the credentials are invalid or the list is full.
  bool add(const char* ssid, const char* password);
  // False for an unknown SSID or the last network: an empty list puts the
  // robot in setup AP mode at the next boot, so only factory reset clears it.
  bool remove(const char* ssid);

  // NVS blob: count() entries back to back. False (list unchanged) when the
  // blob is not a whole number of valid entries.
  bool load(const void* blob, size_t length);
  void clear();

private:
  WifiNetwork networks_[SETTINGS_WIFI_NETWORK_MAX] = {};
  size_t count_ = 0;
};
