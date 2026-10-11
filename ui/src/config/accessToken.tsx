import type { Settings } from "../api/types";
import { Button } from "../status/status";
import { useResettableState } from "../useResettableState";

const MASK = "********";

// A saved token shows as a mask until the field is focused (`draft` stays null); typing replaces
// it and the toggle stages removal. Every settings reply starts it over.
export function useAccessToken(settings: Settings | null) {
  const configured = Boolean(settings?.access_token_set);
  const [{ draft, clearPending }, setState] = useResettableState(settings, () => ({
    draft: null as string | null,
    clearPending: false,
  }));

  return {
    // Value for the access_token field: "" clears, undefined leaves the saved token alone.
    pendingValue: clearPending ? "" : draft || undefined,
    field: {
      configured,
      value: clearPending ? "" : (draft ?? (configured ? MASK : "")),
      clearPending,
      onInput: (next: string) => setState({ draft: next, clearPending }),
      onFocus() {
        if (draft === null) {
          setState({ draft: "", clearPending });
        }
      },
      onBlur() {
        if (configured && draft?.trim() === "") {
          setState({ draft: null, clearPending });
        }
      },
      onToggle: () => setState({ draft: null, clearPending: !clearPending }),
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
