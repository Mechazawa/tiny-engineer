import { beforeEach, describe, expect, it } from "vitest";
import { $, fakeRobot, loadApp, settle, submit } from "./robot.js";

const listedNetworks = () =>
  [...document.querySelectorAll("#wifi-network-list .wifi-network-ssid")].map(
    (node) => node.textContent,
  );

describe("wifi networks", () => {
  beforeEach(() => sessionStorage.clear());

  it("lists the saved networks and keeps the last one", async () => {
    fakeRobot({ settings: { wifi_networks: ["home"] } });
    await loadApp("/config");

    expect(listedNetworks()).toEqual(["home"]);
    expect($("#wifi-network-list .btn").disabled).toBe(true);
  });

  it("adds a network in front of the saved ones", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home"] } });

    await loadApp("/config");

    $("#wifi-network-ssid").value = " office ";
    $("#wifi-network-password").value = "secret";
    await submit("#wifi-network-form");

    expect(robot.lastPost("/settings").params).toEqual({
      wifi_ssid: "office",
      wifi_password: "secret",
    });
    expect(listedNetworks()).toEqual(["office", "home"]);
    expect($("#wifi-network-password").value).toBe("");
  });

  it("removes a network", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["office", "home"] } });

    await loadApp("/config");

    document.querySelectorAll("#wifi-network-list .btn")[0].click();
    await settle();

    expect(robot.lastPost("/settings/wifi/remove").params).toEqual({ wifi_ssid: "office" });
    expect(listedNetworks()).toEqual(["home"]);
    expect($("#status").textContent).toBe("Removed office.");
  });
});
