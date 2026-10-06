import { beforeEach, describe, expect, it } from "vitest";
import { $, fakeRobot, loadApp, submit, type } from "./robot.js";

describe("access token gate", () => {
  beforeEach(() => sessionStorage.clear());

  it("asks for a token when the robot requires one and none is stored", async () => {
    fakeRobot({ authRequired: true, token: "secret" });
    await loadApp("/config");

    expect($("#auth-gate").classList.contains("show")).toBe(true);
    expect(document.body.classList.contains("locked")).toBe(true);
  });

  it("rejects a wrong token without remembering it", async () => {
    fakeRobot({ authRequired: true, token: "secret" });
    await loadApp("/config");

    type("#auth-token", "wrong");
    await submit("#auth-form");

    expect($("#auth-error").classList.contains("show")).toBe(true);
    expect($("#auth-gate").classList.contains("show")).toBe(true);
    expect(sessionStorage.length).toBe(0);
  });

  it("unlocks with the right token and sends it on later requests", async () => {
    const robot = fakeRobot({ authRequired: true, token: "secret" });

    await loadApp("/config");

    type("#auth-token", "secret");
    await submit("#auth-form");

    expect($("#auth-gate").classList.contains("show")).toBe(false);
    expect(document.body.classList.contains("locked")).toBe(false);
    expect(robot.requests.at(-1).authorization).toBe("Bearer secret");
  });

  it("skips the gate when a stored token is still accepted", async () => {
    fakeRobot({ authRequired: true, token: "secret" });
    sessionStorage.setItem("te_access_token", "secret");
    await loadApp("/config");

    expect($("#auth-gate").classList.contains("show")).toBe(false);
    expect($("#view-config").classList.contains("active")).toBe(true);
  });
});
