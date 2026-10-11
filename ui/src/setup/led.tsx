import { useState } from "preact/hooks";
import { api, apiFetch, type Params } from "../api/client";
import { Button, useStatus } from "../status/status";
import { useResettableState } from "../useResettableState";

const RGB_ORDERS = ["RGB", "RBG", "GRB", "GBR", "BRG", "BGR"];
const DEFAULT_ORDER = "GRB";
const CHANNELS = [
  ["R", "Red"],
  ["G", "Green"],
  ["B", "Blue"],
] as const;
const BYTE_LABELS = ["First byte", "Second byte", "Third byte"];

export const releaseLed = () =>
  apiFetch("/setup/led", { method: "POST", params: { byte: "off" } }).catch(() => {});

// `looks` holds the color seen for each WS2812 wire byte; together they spell the RGB order.
export function useLedMapping(savedSetting: string | undefined) {
  const savedOrder =
    savedSetting && RGB_ORDERS.includes(savedSetting) ? savedSetting : DEFAULT_ORDER;
  const [looks, setLooks] = useResettableState(savedOrder, (order) => [...order]);
  const [remapOpen, setRemapOpen] = useState(false);
  const order = looks.join("");

  return {
    savedOrder,
    looks,
    setLooks,
    order,
    valid: RGB_ORDERS.includes(order),
    remapOpen,
    setRemapOpen,
  };
}

type LedMapping = ReturnType<typeof useLedMapping>;

export function LedStep({ mapping }: { mapping: LedMapping }) {
  const { busy, setStatus, clearStatus } = useStatus();

  // Previews skip the busy lock so taps feel instant.
  async function preview(params: Params) {
    if (busy) {
      return;
    }

    try {
      const result = await api("/setup/led", { method: "POST", params });

      if (result.ok) {
        clearStatus();
      } else {
        setStatus(result.data.error || "LED preview failed", "err");
      }
    } catch {
      setStatus("Network error", "err");
    }
  }

  function pickLook(byte: number, look: string) {
    mapping.setLooks(mapping.looks.map((each, index) => (index === byte ? look : each)));
  }

  return (
    <div className="config-section">
      <h3>RGB LED</h3>
      <p className="setup-copy">
        Tap Red, Green, and Blue. The LED should match. If a color looks wrong or stays off, change
        the mapping — some boards swap the LED wires.
      </p>
      <div className="led-test">
        {CHANNELS.map(([channel, name]) => (
          <Button
            key={channel}
            className={`led-${channel.toLowerCase()}`}
            onClick={() =>
              preview({
                color: channel,
                rgb_order: mapping.valid ? mapping.order : mapping.savedOrder,
              })
            }
          >
            {name}
          </Button>
        ))}
      </div>
      <Button id="setup-led-remap-toggle" onClick={() => mapping.setRemapOpen(true)}>
        Change color mapping
      </Button>
      {mapping.remapOpen && (
        <div>
          <p className="setup-copy">
            Light one channel at a time. Tap the color you <strong>actually</strong> see.
          </p>
          <p className="setup-copy">
            <strong>Current mapping</strong>
          </p>
          <div className="led-map">
            {mapping.looks.map((channel, byte) => (
              <div key={byte} className="led-chip-wrap">
                <div className={`led-chip led-${channel.toLowerCase()}`}></div>
                <span className="led-chip-letter">{channel}</span>
              </div>
            ))}
          </div>
          {BYTE_LABELS.map((label, byte) => (
            <div key={label} className="led-byte" role="group" aria-label={label}>
              <p className="led-byte-label">{label}</p>
              <Button className="led-light" onClick={() => preview({ byte })}>
                Light
              </Button>
              <p className="hint">Looks like</p>
              <div className="led-looks">
                {CHANNELS.map(([channel, name]) => (
                  <Button
                    key={channel}
                    className={[
                      `led-${channel.toLowerCase()}`,
                      mapping.looks[byte] === channel && "active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => pickLook(byte, channel)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
