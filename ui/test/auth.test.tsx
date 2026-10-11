import { screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { fakeRobot, renderApp } from "./robot";

describe("access token gate", () => {
  it("asks for a token when the robot requires one and none is stored", async () => {
    fakeRobot({ authRequired: true, token: "secret" });
    await renderApp("/config");

    expect(screen.getByRole("heading", { name: "Access token required" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("rejects a wrong token without remembering it", async () => {
    fakeRobot({ authRequired: true, token: "secret" });
    const { user } = await renderApp("/config");

    await user.type(screen.getByLabelText("Access token"), "wrong{Enter}");

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Invalid access token.");
    expect(sessionStorage.length).toBe(0);
  });

  it("unlocks with the right token and sends it on later requests", async () => {
    const robot = fakeRobot({ authRequired: true, token: "secret" });
    const { user } = await renderApp("/config");

    await user.type(screen.getByLabelText("Access token"), "secret{Enter}");

    expect(await screen.findByRole("heading", { name: "Config" })).toBeTruthy();
    expect(robot.requests.at(-1)?.authorization).toBe("Bearer secret");
  });

  it("skips the gate when a stored token is still accepted", async () => {
    fakeRobot({ authRequired: true, token: "secret" });
    sessionStorage.setItem("te_access_token", "secret");
    await renderApp("/config");

    expect(await screen.findByRole("heading", { name: "Config" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Access token required" })).toBeNull();
  });
});
