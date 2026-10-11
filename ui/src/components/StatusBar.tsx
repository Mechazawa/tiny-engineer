import { useStatus } from "../status/status";

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
