import { Button } from "../components/Button";
import { ConfigSection } from "../components/ConfigSection";

export function ScreenStep({ onRotate }: { onRotate: () => void }) {
  return (
    <ConfigSection title="Screen">
      <p className="setup-copy">
        Look at the OLED. Text should read right-side up. Tap Rotate 180° if it is upside down.
      </p>
      <Button variant="primary" onClick={onRotate}>
        Rotate 180°
      </Button>
    </ConfigSection>
  );
}
