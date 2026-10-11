import { screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { fakeRobot, renderApp } from "./robot";

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

describe("config page", () => {
  it("fills the form from the robot's settings", async () => {
    fakeRobot({ settings: { hostname: "desk-bot", volume: 35, eyes_style: "dots" } });
    await renderApp("/config");

    expect(field("Hostname").value).toBe("desk-bot");
    expect(screen.getByText("35%")).toBeTruthy();
    expect(field("Eyes style").value).toBe("dots");
  });

  it("saves the form without touching a saved token", async () => {
    const robot = fakeRobot({ settings: { access_token_set: true } });
    const { user, click } = await renderApp("/config");

    await user.clear(field("Sleep timeout (minutes)"));
    await user.type(field("Sleep timeout (minutes)"), "20");
    await click("Save settings");

    expect(robot.lastPost("/settings")?.json).toEqual({
      sleep_timeout: 20,
      hostname: "tiny-engineer",
      volume: 70,
      welcome: true,
      serial_log: false,
      continuous_timeout: 5,
      loading: "progress",
      eyes_style: "classic",
    });
    expect(screen.getByRole("status").textContent).toBe("Settings saved.");
  });

  it("says when a hostname change needs a reboot", async () => {
    fakeRobot();
    const { user, click } = await renderApp("/config");

    await user.clear(field("Hostname"));
    await user.type(field("Hostname"), "desk-bot");
    await click("Save settings");

    expect(screen.getByRole("status").textContent).toBe("Saved. Hostname applies after reboot.");
  });

  it("sends an empty token to remove it and forgets the stored copy", async () => {
    const robot = fakeRobot({ settings: { access_token_set: true } });

    sessionStorage.setItem("te_access_token", "old");

    const { click } = await renderApp("/config");

    await click("Remove token");
    await click("Save settings");

    expect(robot.lastPost("/settings")?.json).toHaveProperty("access_token", "");
    expect(sessionStorage.getItem("te_access_token")).toBeNull();
    expect(screen.getByText("Auth disabled")).toBeTruthy();
  });

  it("replaces the token with a typed one and keeps using it", async () => {
    const robot = fakeRobot({ settings: { access_token_set: true } });
    const { user, click } = await renderApp("/config");

    await user.type(field("Access token"), "new-token");
    await click("Save settings");

    expect(robot.lastPost("/settings")?.json).toHaveProperty("access_token", "new-token");
    expect(sessionStorage.getItem("te_access_token")).toBe("new-token");
    expect(field("Access token").value).toBe("********");
  });
});
