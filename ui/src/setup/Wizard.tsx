import { useEffect, useState } from "preact/hooks";
import { apiFetch } from "../api/client";
import type { Settings } from "../api/types";
import { useRobot } from "../robot";
import { Button, useStatus } from "../status/status";
import { useResettableState } from "../useResettableState";
import { FindRanges, PlaceParts, useCalibration } from "./calibration";
import { LedStep, releaseLed, useLedMapping } from "./led";
import { NetworkStep, ScreenStep, SpeakerStep } from "./steps";

const STEPS = [
  { id: "servos", title: "Servos", next: "Next: Screen" },
  { id: "oled", title: "Screen", next: "Next: RGB mapping" },
  { id: "led", title: "RGB mapping", next: "Next: Speaker" },
  { id: "speaker", title: "Speaker", next: "Next: Network" },
  { id: "network", title: "Network", next: null },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// No body restores the setup screen.
const previewOled = (json?: { rotate_180: boolean }) =>
  apiFetch("/setup/oled", { method: "POST", json }).catch(() => {});

export function Wizard({ settings }: { settings: Settings }) {
  const { applySettings } = useRobot();
  const { perform, clearStatus } = useStatus();
  const [stepIndex, setStepIndex] = useState(0);
  const [oledRotate180, setOledRotate180] = useResettableState(settings.oled_rotate_180, Boolean);
  const calibration = useCalibration(settings);
  const led = useLedMapping(settings.rgb_order);
  const step = STEPS[stepIndex];
  const placingParts = step.id === "servos" && calibration.phase === "horns";
  const goTo = (id: StepId) => setStepIndex(STEPS.findIndex((each) => each.id === id));

  useEffect(() => {
    releaseLed();
  }, []);

  async function save(json: Partial<Settings>, pending: string) {
    const result = await perform<Settings>({
      path: "/settings",
      request: { method: "POST", json },
      pending,
      failure: "Save failed",
    });

    if (!result?.ok) {
      return false;
    }

    applySettings(result.data);
    clearStatus();

    return true;
  }

  const advance: Partial<Record<StepId, () => unknown>> = {
    async servos() {
      const saved = await save(
        {
          servo_mins: calibration.ranges.map(([min]) => min),
          servo_maxs: calibration.ranges.map(([, max]) => max),
        },
        "Saving servo ranges…",
      );

      if (saved) {
        goTo("oled");
        previewOled({ rotate_180: oledRotate180 });
      }
    },
    async oled() {
      if (await save({ oled_rotate_180: oledRotate180 }, "Saving screen rotation…")) {
        goTo("led");
      }
    },
    async led() {
      if (await save({ rgb_order: led.order }, "Saving LED mapping…")) {
        releaseLed();
        goTo("speaker");
      }
    },
    speaker: () => goTo("network"),
  };

  const retreat: Record<StepId, () => void> = {
    servos: () => calibration.setPhase("horns"),
    oled() {
      previewOled();
      goTo("servos");
      calibration.setPhase("ranges");
    },
    led() {
      releaseLed();
      goTo("oled");
      previewOled({ rotate_180: oledRotate180 });
    },
    speaker: () => goTo("led"),
    network: () => goTo("speaker"),
  };

  function rotateOled() {
    const next = !oledRotate180;

    setOledRotate180(next);
    previewOled({ rotate_180: next });
  }

  const blocked = (step.id === "servos" && !calibration.valid) || (step.id === "led" && !led.valid);

  return (
    <div id="setup-wizard">
      <h2 className="page-title">Tiny Engineer setup</h2>
      <p className="page-desc">{`Step ${stepIndex + 1} of ${STEPS.length} · ${step.title}`}</p>
      <div className="setup-progress-track">
        <div
          className="setup-progress-bar"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        ></div>
      </div>
      {step.id === "servos" &&
        (placingParts ? (
          <PlaceParts calibration={calibration} />
        ) : (
          <FindRanges calibration={calibration} />
        ))}
      {step.id === "oled" && <ScreenStep onRotate={rotateOled} />}
      {step.id === "led" && <LedStep mapping={led} />}
      {step.id === "speaker" && <SpeakerStep />}
      {step.id === "network" && <NetworkStep settings={settings} />}
      {!placingParts && (
        <div className="setup-footer">
          <Button onClick={retreat[step.id]}>Back</Button>
          {step.next && (
            <Button variant="primary" disabled={blocked} onClick={() => advance[step.id]?.()}>
              {step.next}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
