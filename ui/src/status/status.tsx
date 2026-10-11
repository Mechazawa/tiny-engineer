import { type ComponentChildren, type ComponentProps, createContext } from "preact";
import { useCallback, useContext, useMemo, useRef, useState } from "preact/hooks";
import { api, type ApiResult, type Request } from "../api/client";

type StatusType = "loading" | "ok" | "err";

export interface Action<T> {
  path: string;
  request?: Request;
  pending: string;
  failure: string;
  // Runs before the controls unlock, for follow-up requests that belong to the same action.
  onSuccess?: (data: T) => unknown;
}

interface StatusApi {
  busy: boolean;
  status: { message: string; type?: StatusType } | null;
  setStatus: (message: string, type?: StatusType) => void;
  clearStatus: () => void;
  // Resolves to the result, or null when another action is running or the request failed to send.
  perform: <T>(action: Action<T>) => Promise<ApiResult<T> | null>;
}

const StatusContext = createContext<StatusApi | null>(null);

export function useStatus(): StatusApi {
  const value = useContext(StatusContext);

  if (!value) {
    throw new Error("useStatus outside StatusProvider");
  }

  return value;
}

export function StatusProvider({ children }: { children: ComponentChildren }) {
  const [status, setStatusState] = useState<StatusApi["status"]>(null);
  const [busy, setBusy] = useState(false);
  // The ref blocks a second action in the same tick, before the busy state renders.
  const runningRef = useRef(false);

  const setStatus = useCallback((message: string, type?: StatusType) => {
    setStatusState({ message, type });
  }, []);
  const clearStatus = useCallback(() => setStatusState(null), []);

  const perform = useCallback(
    async <T,>({ path, request = { method: "POST" }, pending, failure, onSuccess }: Action<T>) => {
      if (runningRef.current) {
        return null;
      }

      runningRef.current = true;
      setBusy(true);
      setStatus(pending, "loading");

      try {
        const result = await api<T>(path, request);

        if (!result.ok) {
          setStatus(result.data.error || failure, "err");
        } else if (onSuccess) {
          await onSuccess(result.data);
        }

        return result;
      } catch {
        setStatus("Network error", "err");

        return null;
      } finally {
        runningRef.current = false;
        setBusy(false);
      }
    },
    [setStatus],
  );

  const value = useMemo(
    () => ({ busy, status, setStatus, clearStatus, perform }),
    [busy, status, setStatus, clearStatus, perform],
  );

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function StatusBar() {
  const { status } = useStatus();

  if (!status) {
    return null;
  }

  return (
    <div id="status" role="status" className={status.type}>
      {status.message}
    </div>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "danger" };

// Every button locks while an action runs.
export function Button({ variant, className, disabled, ...props }: ButtonProps) {
  const { busy } = useStatus();
  const classes = ["btn", variant && `btn-${variant}`, className].filter(Boolean).join(" ");

  return (
    <button type="button" {...props} className={classes} disabled={busy || Boolean(disabled)} />
  );
}
