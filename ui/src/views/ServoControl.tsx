import { useState } from "preact/hooks";
import { useRobot } from "../robot";
import { DEFAULT_SERVO_RANGES, SERVO_NAMES, savedRanges } from "../servos";
import { Button } from "../components/Button";
import { useStatus } from "../status/status";

export function ServoControl() {
  const { settings } = useRobot();
  const { perform, setStatus } = useStatus();
  // Until the settings load, the stock ranges stand in.
  const ranges = settings ? savedRanges(settings) : DEFAULT_SERVO_RANGES;
  const [index, setIndex] = useState(0);
  const [angle, setAngle] = useState("90");
  const [min, max] = ranges[index];
  const mid = (min + max) / 2;
  const value = parseFloat(angle);
  const safe = value >= min && value <= max;

  function selectServo(next: number) {
    const [nextMin, nextMax] = ranges[next];

    setIndex(next);

    if (!(value >= nextMin && value <= nextMax)) {
      setAngle(String((nextMin + nextMax) / 2));
    }
  }

  async function move(target: string) {
    const result = await perform({
      path: "/test/servo",
      request: { method: "POST", json: { index, angle: Number(target) } },
      pending: "Moving servo…",
      failure: "Move failed",
    });

    if (result?.ok) {
      setStatus(`Servo ${index} moved to ${target}°.`, "ok");
    }
  }

  return (
    <section>
      <h2 className="page-title">Servo control</h2>
      <p className="page-desc">Move a single servo to a target angle.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          move(angle);
        }}
      >
        <div className="form-group">
          <label htmlFor="servo-index">Servo</label>
          <select
            id="servo-index"
            value={index}
            onChange={(event) => selectServo(Number(event.currentTarget.value))}
          >
            {SERVO_NAMES.map((name, servo) => (
              <option key={name} value={servo}>
                {servo} — {name}
              </option>
            ))}
          </select>
          <p id="servo-range-hint" className={safe ? "hint" : "hint warn"}>
            {safe
              ? `Safe range: ${min}–${max}°`
              : `Outside safe range — firmware clamps to ${min}–${max}°`}
          </p>
        </div>
        <div className="form-group">
          <label htmlFor="servo-angle">Angle</label>
          <div className="range-row servo-range">
            <div className="servo-slider-wrap">
              <div className="servo-slider-track">
                <div className="servo-slider-bg">
                  <div className="servo-safe-band"></div>
                </div>
                <input
                  type="range"
                  className="servo-slider"
                  aria-label="Angle slider"
                  min={min}
                  max={max}
                  value={angle}
                  onInput={(event) => setAngle(event.currentTarget.value)}
                />
              </div>
              <div className="servo-scale">
                <span>{min}°</span>
                <span>{Math.round(mid)}°</span>
                <span>{max}°</span>
              </div>
            </div>
            <input
              type="number"
              id="servo-angle"
              min={min}
              max={max}
              value={angle}
              onInput={(event) => setAngle(event.currentTarget.value)}
            />
          </div>
        </div>
        <div className="servo-actions">
          <Button
            onClick={() => {
              setAngle(String(mid));
              move(String(mid));
            }}
          >
            Center
          </Button>
          <Button type="submit" variant="primary">
            Move servo
          </Button>
        </div>
      </form>
    </section>
  );
}
