import { describe, expect, it } from "vitest";
import { $, fakeRobot, loadApp, submit, type } from "./robot.js";

describe("servo page", () => {
  it("bounds the slider by the selected joint's saved range", async () => {
    fakeRobot({
      settings: { servo_mins: [70, 40, 45, 35, 40], servo_maxs: [110, 130, 135, 125, 130] },
    });
    await loadApp("/servo");

    expect($("#servo-slider").min).toBe("70");
    expect($("#servo-slider").max).toBe("110");
    expect($("#servo-scale-mid").textContent).toBe("90°");
  });

  it("warns when a typed angle is outside the safe range", async () => {
    fakeRobot();
    await loadApp("/servo");

    type("#servo-angle", "150");

    expect($("#servo-range-hint").classList.contains("warn")).toBe(true);
    expect($("#servo-range-hint").textContent).toContain("firmware clamps to 60–130°");
  });

  it("moves only when the form is submitted", async () => {
    const robot = fakeRobot();

    await loadApp("/servo");

    type("#servo-angle", "100");

    expect(robot.posts("/test/servo")).toHaveLength(0);

    await submit("#servo-form");

    expect(robot.lastPost("/test/servo").params).toEqual({ index: "0", angle: "100" });
  });
});
