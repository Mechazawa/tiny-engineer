import { screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { fakeRobot, renderApp } from "./robot";

describe("servo page", () => {
  it("bounds the slider by the selected joint's saved range", async () => {
    fakeRobot({
      settings: { servo_mins: [70, 40, 45, 35, 40], servo_maxs: [110, 130, 135, 125, 130] },
    });
    await renderApp("/servo");

    const slider = await screen.findByLabelText("Angle slider");

    expect(slider.getAttribute("min")).toBe("70");
    expect(slider.getAttribute("max")).toBe("110");
  });

  it("warns when a typed angle is outside the safe range", async () => {
    fakeRobot();
    const { user } = await renderApp("/servo");
    const angle = screen.getByRole("spinbutton", { name: "Angle" });

    await user.clear(angle);
    await user.type(angle, "150");

    expect(screen.getByText(/firmware clamps to 60–130°/).classList.contains("warn")).toBe(true);
  });

  it("moves only when the form is submitted", async () => {
    const robot = fakeRobot();
    const { user } = await renderApp("/servo");
    const angle = screen.getByRole("spinbutton", { name: "Angle" });

    await user.clear(angle);
    await user.type(angle, "100");

    expect(robot.posts("/test/servo")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Move servo" }));

    expect(robot.lastPost("/test/servo")?.json).toEqual({ index: 0, angle: 100 });
  });
});
