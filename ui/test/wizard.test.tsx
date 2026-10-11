import { screen, within } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { fakeRobot, renderApp } from "./robot";

const angle = () => screen.getByTestId("calib-angle").textContent;
const stepLabel = () => screen.getByText(/^Step \d of 5/).textContent;

async function startCalibration(settings = {}) {
  const robot = fakeRobot({ provisioning: true, settings });
  const app = await renderApp("/");

  await app.click("Parts are on →");

  return { robot, ...app };
}

describe("setup wizard", () => {
  it("takes over the config page while the robot is provisioning", async () => {
    fakeRobot({ provisioning: true });
    await renderApp("/");

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("heading", { name: "Tiny Engineer setup" })).toBeTruthy();
    expect(stepLabel()).toBe("Step 1 of 5 · Servos");
  });

  it("offers no control that moves a servo from the calibration bar", async () => {
    await startCalibration();

    const guide = document.querySelector(".calib-guide");

    expect(guide?.getAttribute("aria-hidden")).toBe("true");
    expect(guide?.querySelector("input, button")).toBeNull();
  });

  it("moves the selected joint in steps and stops at 180°", async () => {
    const { robot, click } = await startCalibration();

    for (let i = 0; i < 10; i++) {
      await click("+10°");
    }

    expect(angle()).toBe("180");
    expect(
      robot
        .sent("POST", "/setup/servo")
        .map((request) => (request.json as { angle: number }).angle),
    ).toEqual([100, 110, 120, 130, 140, 150, 160, 170, 180]);
  });

  it("restores the shown angle when a move fails", async () => {
    const { robot, click } = await startCalibration();

    robot.failing.add("/setup/servo");
    await click("+5°");

    expect(angle()).toBe("90");
    expect(screen.getByRole("status").textContent).toBe("robot said no");
  });

  it("keeps each joint's angle when switching tabs", async () => {
    const { robot, click } = await startCalibration();

    await click("−10°");
    await click("Neck");

    expect(angle()).toBe("90");

    await click("+1°");

    expect(robot.lastPost("/setup/servo")?.json).toEqual({ index: 1, angle: 91 });

    await click("Head");

    expect(angle()).toBe("80");
  });

  it("refuses a min at or above the max", async () => {
    const { click } = await startCalibration();

    await click("Set max (130°)");
    await click("+5°");
    await click("Set min (60°)");

    expect(screen.getByRole("status").textContent).toBe("Min must be less than max.");
    expect(screen.getByRole("button", { name: "Set min (60°)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Set max (90°)" })).toBeTruthy();
  });

  it("saves the calibrated ranges and previews the screen on Next", async () => {
    const { robot, click } = await startCalibration();

    await click("−10°");
    await click("Set min (60°)");
    await click("Next: Screen");

    expect(robot.lastPost("/settings")?.json).toEqual({
      servo_mins: [80, 40, 45, 35, 40],
      servo_maxs: [130, 130, 135, 125, 130],
    });
    expect(robot.lastPost("/setup/oled")?.json).toEqual({ rotate_180: false });
    expect(stepLabel()).toBe("Step 2 of 5 · Screen");
  });

  it("saves the hostname, then tests the new network ahead of the saved ones", async () => {
    const { robot, user, click } = await startCalibration({ wifi_networks: ["old"] });

    for (const next of ["Next: Screen", "Next: RGB mapping", "Next: Speaker", "Next: Network"]) {
      await click(next);
    }

    await user.type(screen.getByLabelText("Network name (SSID)"), "home");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.clear(screen.getByLabelText("Hostname"));
    await user.type(screen.getByLabelText("Hostname"), "desk-bot");

    const writesBefore = robot.requests.length;

    await click("Connect to WiFi");

    const writes = robot.requests.slice(writesBefore).filter((request) => request.method !== "GET");

    expect(writes.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /settings",
      "PUT /settings/wifi",
    ]);
    expect(writes[0].json).toEqual({ hostname: "desk-bot" });
    expect(writes[1].json).toEqual([{ ssid: "home", password: "secret" }, { ssid: "old" }]);
    expect(screen.getByRole("status").textContent).toContain("WiFi connected");
    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  it("blocks a color mapping that uses a color twice", async () => {
    const { robot, click, user } = await startCalibration();

    await click("Next: Screen");
    await click("Next: RGB mapping");

    expect(stepLabel()).toBe("Step 3 of 5 · RGB mapping");

    await click("Change color mapping");

    const byte = (name: string) => within(screen.getByRole("group", { name }));
    const next = () => screen.getByRole<HTMLButtonElement>("button", { name: "Next: Speaker" });

    await user.click(byte("First byte").getByRole("button", { name: "Red" }));

    expect(next().disabled).toBe(true);

    await user.click(byte("Second byte").getByRole("button", { name: "Green" }));

    expect(next().disabled).toBe(false);

    await click("Next: Speaker");

    expect(robot.lastPost("/settings")?.json).toEqual({ rgb_order: "RGB" });
    expect(stepLabel()).toBe("Step 4 of 5 · Speaker");
  });
});
