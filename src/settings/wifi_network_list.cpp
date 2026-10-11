#include "settings/wifi_network_list.h"

#include <algorithm>
#include <cstring>

namespace {

bool terminated(const char* text, size_t size) {
  return memchr(text, '\0', size) != nullptr;
}

bool validEntry(const WifiNetwork& network) {
  return terminated(network.ssid, sizeof(network.ssid)) &&
         terminated(network.password, sizeof(network.password)) &&
         settingsValidateWifiSsid(network.ssid) &&
         settingsValidateWifiPassword(network.password);
}

}  // namespace

size_t WifiNetworkList::count() const {
  return count_;
}

const WifiNetwork& WifiNetworkList::at(size_t index) const {
  return networks_[index];
}

const WifiNetwork* WifiNetworkList::data() const {
  return networks_;
}

int WifiNetworkList::find(const char* ssid) const {
  const WifiNetwork* end = networks_ + count_;
  const WifiNetwork* match = std::find_if(
    networks_,
    end,
    [ssid](const WifiNetwork& network) {
      return strcmp(network.ssid, ssid) == 0;
    }
  );

  return match == end ? -1 : static_cast<int>(match - networks_);
}

bool WifiNetworkList::add(const char* ssid, const char* password) {
  if (!settingsValidateWifiSsid(ssid) ||
      !settingsValidateWifiPassword(password)) {
    return false;
  }

  const int existing = find(ssid);

  if (existing < 0 && count_ == SETTINGS_WIFI_NETWORK_MAX) {
    return false;
  }

  const size_t shifted =
    existing < 0 ? count_ : static_cast<size_t>(existing);

  memmove(&networks_[1], &networks_[0], shifted * sizeof(WifiNetwork));

  if (existing < 0) {
    count_++;
  }

  networks_[0] = {};
  strncpy(networks_[0].ssid, ssid, SETTINGS_WIFI_SSID_MAX_LEN);
  strncpy(networks_[0].password, password, SETTINGS_WIFI_PASSWORD_MAX_LEN);
  return true;
}

bool WifiNetworkList::remove(const char* ssid) {
  const int index = find(ssid);

  if (index < 0 || count_ == 1) {
    return false;
  }

  memmove(
    &networks_[index],
    &networks_[index + 1],
    (count_ - index - 1) * sizeof(WifiNetwork)
  );
  count_--;
  networks_[count_] = {};
  return true;
}

bool WifiNetworkList::load(const void* blob, size_t length) {
  const size_t loadedCount = length / sizeof(WifiNetwork);

  if (length % sizeof(WifiNetwork) != 0 ||
      loadedCount > SETTINGS_WIFI_NETWORK_MAX) {
    return false;
  }

  const auto* loaded = static_cast<const WifiNetwork*>(blob);

  if (!std::all_of(loaded, loaded + loadedCount, validEntry)) {
    return false;
  }

  clear();
  std::copy(loaded, loaded + loadedCount, networks_);
  count_ = loadedCount;
  return true;
}

void WifiNetworkList::clear() {
  std::fill(networks_, networks_ + SETTINGS_WIFI_NETWORK_MAX, WifiNetwork{});
  count_ = 0;
}
