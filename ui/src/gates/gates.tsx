import { useState } from "preact/hooks";
import { useRobot } from "../robot";
import { Button } from "../status/status";

export function AuthGate() {
  const { unlock } = useRobot();
  const [candidate, setCandidate] = useState("");
  const [rejected, setRejected] = useState(false);

  async function submit(event: Event) {
    event.preventDefault();

    if (!candidate) {
      return;
    }

    setRejected(false);

    if (!(await unlock(candidate))) {
      setRejected(true);
    }
  }

  return (
    <div className="gate">
      <div className="gate-box">
        <h1>Access token required</h1>
        <p>Enter the device access token to use the control panel.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="auth-token">Access token</label>
            <input
              type="password"
              id="auth-token"
              autoComplete="current-password"
              required
              autoFocus
              value={candidate}
              onInput={(event) => setCandidate(event.currentTarget.value)}
            />
          </div>
          {rejected && (
            <div id="auth-error" role="alert">
              Invalid access token.
            </div>
          )}
          <Button type="submit" variant="primary">
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
}

export function RebootGate() {
  return (
    <div className="gate">
      <div className="gate-box">
        <h1>Factory reset done</h1>
        <p>
          Settings and WiFi credentials are cleared. Servo ranges, RGB LED mapping, and screen
          rotation stay. Power-cycle or press the device reset button.
        </p>
        <p>
          Then join the robot WiFi shown on the OLED and open the setup page to configure home WiFi.
          You can retune servo ranges, screen rotation, and LED mapping there.
        </p>
      </div>
    </div>
  );
}
