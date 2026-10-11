import type { TargetedSubmitEvent } from "preact";
import { useState } from "preact/hooks";
import { Button } from "../components/Button";
import { useRobot } from "../robot";

export function AuthGate() {
  const { unlock } = useRobot();
  const [candidate, setCandidate] = useState("");
  const [rejected, setRejected] = useState(false);

  async function submit(event: TargetedSubmitEvent<HTMLFormElement>) {
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
