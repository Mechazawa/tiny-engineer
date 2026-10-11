import type { Settings } from "../api/types";
import { Button } from "../status/status";
import { useResettableState } from "../useResettableState";

const MASK = "********";

// The field shows a mask while a token is saved; typing replaces it, the toggle stages removal.
// Every settings reply starts it over, so a saved token shows masked again.
export function useAccessToken(settings: Settings | null) {
  const configured = Boolean(settings?.access_token_set);
  const [{ value, masked, clearPending }, setState] = useResettableState(settings, () => ({
    value: configured ? MASK : "",
    masked: configured,
    clearPending: false,
  }));

  // Value for the access_token param: "" clears, undefined leaves the saved token alone.
  let pendingValue: string | undefined;

  if (clearPending) {
    pendingValue = "";
  } else if (!masked && value) {
    pendingValue = value;
  }

  return {
    pendingValue,
    field: {
      configured,
      value: clearPending ? "" : value,
      clearPending,
      onInput: (next: string) => setState({ value: next, masked, clearPending }),
      onFocus() {
        if (masked) {
          setState({ value: "", masked: false, clearPending });
        }
      },
      onBlur() {
        if (configured && !clearPending && value.trim() === "") {
          setState({ value: MASK, masked: true, clearPending });
        }
      },
      onToggle() {
        setState({ value: MASK, masked: clearPending, clearPending: !clearPending });
      },
    },
  };
}

type FieldProps = ReturnType<typeof useAccessToken>["field"];

export function AccessTokenField({ configured, value, clearPending, ...on }: FieldProps) {
  let placeholder = "Enter access token";
  let status = "Auth disabled";

  if (clearPending) {
    placeholder = "Token will be removed on Save";
    status = "Will remove on save";
  } else if (configured) {
    placeholder = "Enter a new token to replace";
    status = "Auth enabled — click field to replace";
  }

  return (
    <div className="form-group">
      <label htmlFor="config-access-token">Access token</label>
      <div className="token-row">
        <input
          type="password"
          id="config-access-token"
          maxLength={64}
          autoComplete="new-password"
          placeholder={placeholder}
          disabled={clearPending}
          value={value}
          onInput={(event) => on.onInput(event.currentTarget.value)}
          onFocus={on.onFocus}
          onBlur={on.onBlur}
        />
        <Button
          className="btn-token-toggle"
          hidden={!configured && !clearPending}
          onClick={on.onToggle}
        >
          {clearPending ? "Undo" : "Remove token"}
        </Button>
      </div>
      <p className="hint">{status}</p>
    </div>
  );
}
