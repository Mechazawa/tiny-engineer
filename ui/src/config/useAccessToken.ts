import type { Settings } from "../api/types";
import { useResettableState } from "../useResettableState";

const MASK = "********";

// A saved token shows as a mask until the field is focused (`draft` stays null); typing replaces
// it and the toggle stages removal. Every settings reply starts it over.
export function useAccessToken(settings: Settings) {
  const configured = settings.access_token_set;
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
