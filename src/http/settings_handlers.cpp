#include <Arduino.h>

#include "display/oled.h"
#include "http/handlers.h"
#include "http/request.h"
#include "http/response.h"
#include "network/wifi_connect.h"
#include "settings/settings.h"
#include "settings/wifi_network_list.h"

namespace {

template <typename T>
bool readValue(JsonObjectConst body, const char* key, std::optional<T>& out) {
  const JsonVariantConst value = body[key];

  if (value.isNull()) {
    return true;
  }

  if (!value.is<T>()) {
    return false;
  }

  out = value.as<T>();
  return true;
}

bool readText(JsonObjectConst body, const char* key, const char*& out) {
  const JsonVariantConst value = body[key];

  if (value.isNull()) {
    return true;
  }

  out = value.as<const char*>();
  return out != nullptr;
}

bool readServoList(JsonVariantConst list, uint8_t (&out)[SETTINGS_SERVO_COUNT]) {
  if (!list.is<JsonArrayConst>() || list.size() != SETTINGS_SERVO_COUNT) {
    return false;
  }

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    if (!list[i].is<uint8_t>()) {
      return false;
    }

    out[i] = list[i].as<uint8_t>();
  }

  return true;
}

// Name of the first field with the wrong JSON type, or nullptr once the patch holds every field.
const char* readPatch(JsonObjectConst body, SettingsPatch& patch) {
  if (!readValue(body, "sleep_timeout", patch.sleepTimeoutMin)) {
    return "sleep_timeout";
  }

  if (!readText(body, "hostname", patch.hostname)) {
    return "hostname";
  }

  if (!readValue(body, "volume", patch.volume)) {
    return "volume";
  }

  if (!readValue(body, "welcome", patch.welcome)) {
    return "welcome";
  }

  if (!readValue(body, "serial_log", patch.serialLog)) {
    return "serial_log";
  }

  if (!readValue(body, "continuous_timeout", patch.continuousTimeoutMin)) {
    return "continuous_timeout";
  }

  if (!readText(body, "loading", patch.loading)) {
    return "loading";
  }

  if (!readText(body, "eyes_style", patch.eyesStyle)) {
    return "eyes_style";
  }

  if (!readText(body, "access_token", patch.accessToken)) {
    return "access_token";
  }

  if (!readText(body, "rgb_order", patch.rgbOrder)) {
    return "rgb_order";
  }

  if (!readValue(body, "oled_rotate_180", patch.oledRotate180)) {
    return "oled_rotate_180";
  }

  if (!body["servo_mins"].isNull() || !body["servo_maxs"].isNull()) {
    ServoRanges ranges{};

    if (!readServoList(body["servo_mins"], ranges.mins) ||
        !readServoList(body["servo_maxs"], ranges.maxs)) {
      return "servo_mins or servo_maxs";
    }

    patch.servoRanges = ranges;
  }

  return nullptr;
}

// Servo ranges, RGB mapping and screen rotation belong to the setup wizard.
const char* setupOnlyStep(const SettingsPatch& patch) {
  if (patch.servoRanges) {
    return "servo";
  }

  if (patch.rgbOrder != nullptr) {
    return "rgb";
  }

  if (patch.oledRotate180) {
    return "oled";
  }

  return nullptr;
}

JsonDocument settingsJson() {
  JsonDocument doc;

  doc["ok"] = true;
  doc["sleep_timeout"] = settingsSleepTimeoutMin();
  doc["hostname"] = settingsHostname();
  doc["volume"] = settingsVolume();
  doc["welcome"] = settingsWelcomeEnabled();
  doc["serial_log"] = settingsSerialLogEnabled();
  doc["continuous_timeout"] = settingsContinuousTimeoutMin();
  doc["loading"] = settingsLoading();
  doc["eyes_style"] = settingsEyesStyle();
  doc["access_token_set"] = settingsAccessTokenSet();
  doc["wifi_configured"] = settingsWifiConfigured();

  JsonArray servoMins = doc["servo_mins"].to<JsonArray>();
  JsonArray servoMaxs = doc["servo_maxs"].to<JsonArray>();

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    servoMins.add(static_cast<unsigned>(settingsServoMin(i)));
    servoMaxs.add(static_cast<unsigned>(settingsServoMax(i)));
  }

  doc["rgb_order"] = settingsRgbOrder();
  doc["oled_rotate_180"] = settingsOledRotate180();

  const WifiNetworkList& networks = settingsWifiNetworks();
  JsonArray ssids = doc["wifi_networks"].to<JsonArray>();

  for (size_t i = 0; i < networks.count(); i++) {
    ssids.add(networks.at(i).ssid);
  }

  return doc;
}

}  // namespace

void handleSettingsGet(WebServer& server) {
  sendJson(server, 200, settingsJson());
}

void handleSettingsPost(WebServer& server) {
  JsonDocument body;

  if (!readJsonBody(server, body)) {
    return;
  }

  if (body.size() == 0) {
    sendError(server, 400, "send at least one setting");
    return;
  }

  SettingsPatch patch;
  const char* invalid = readPatch(body.as<JsonObjectConst>(), patch);

  if (invalid == nullptr) {
    invalid = patch.invalidField();
  }

  if (invalid != nullptr) {
    sendError(server, 400, (String("invalid ") + invalid).c_str());
    return;
  }

  const char* setupStep = setupOnlyStep(patch);

  if (setupStep != nullptr && !wifiProvisioningMode()) {
    sendError(server, 400, (String(setupStep) + " setup only in AP mode").c_str());
    return;
  }

  bool rebootRequired = false;

  if (!saveSettings(patch, &rebootRequired)) {
    sendError(server, 400, "save failed");
    return;
  }

  if (patch.oledRotate180) {
    applyOledRotation();
    restoreProvisioningOled();
  }

  JsonDocument reply = settingsJson();
  reply["reboot_required"] = rebootRequired;
  sendJson(server, 200, reply);
}

void handleSettingsWifiPut(WebServer& server) {
  JsonDocument body;

  if (deserializeJson(body, server.arg("plain")) ||
      !body.is<JsonArrayConst>()) {
    sendError(server, 400, "body must be a JSON array of networks");
    return;
  }

  const JsonArrayConst entries = body.as<JsonArrayConst>();

  // An empty list would put the robot in setup AP mode at the next boot;
  // factory reset is the way to clear WiFi.
  if (entries.size() == 0) {
    sendError(server, 400, "send at least one wifi network");
    return;
  }

  const WifiNetworkList& saved = settingsWifiNetworks();
  WifiNetworkList next;

  for (const JsonObjectConst entry : entries) {
    const JsonVariantConst passwordField = entry["password"];
    // A missing key keeps the saved password; an explicit null is an error.
    const bool keepsPassword = passwordField.isUnbound();

    if (!entry["ssid"].is<const char*>() ||
        !(keepsPassword || passwordField.is<const char*>())) {
      sendError(server, 400, "each network needs a string ssid and an optional string password");
      return;
    }

    const char* ssid = entry["ssid"];
    const char* password = keepsPassword ? saved.passwordFor(ssid)
                                         : passwordField.as<const char*>();

    if (password == nullptr) {
      sendError(server, 400, "password required for a new network");
      return;
    }

    if (!next.add(ssid, password)) {
      sendError(server, 400, "invalid ssid or password, duplicate ssid, or more than 5 networks");
      return;
    }
  }

  // Outside setup AP mode a test would drop the connection serving this
  // request, so the list is saved untested.
  const bool tested = wifiProvisioningMode();

  if (tested &&
      !wifiTestCredentials(next.at(0).ssid, next.at(0).password)) {
    sendError(server, 400, wifiLastConnectError());
    return;
  }

  if (!saveWifiNetworks(next)) {
    if (tested) {
      wifiRestoreProvisioningAp();
    }

    sendError(server, 400, "save failed");
    return;
  }

  JsonDocument reply = settingsJson();

  if (tested) {
    reply["wifi_connect_success"] = true;
    reply["wifi_ip"] = wifiIpText();
    reply["wifi_hostname"] = String(settingsHostname()) + ".local";
  }

  sendJson(server, 200, reply);

  if (tested) {
    delay(300);
    wifiStopProvisioningAp();
    showBootIp(wifiIpText());
  }
}

void handleSettingsReset(WebServer& server) {
  bool rebootRequired = false;

  if (!factoryResetSettings(&rebootRequired)) {
    sendError(server, 400, "factory reset failed");
    return;
  }

  JsonDocument reply = settingsJson();
  reply["reboot_required"] = rebootRequired;
  sendJson(server, 200, reply);
}
