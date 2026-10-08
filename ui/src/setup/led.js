import { apiPost, postQuietly } from "../api.js";
import { $, $$, element } from "../dom.js";
import { clearStatus, isBusy, setStatus } from "../status.js";

const RGB_ORDERS = ["RGB", "RBG", "GRB", "GBR", "BRG", "BGR"];
const DEFAULT_ORDER = "GRB";

async function preview(params) {
  try {
    const result = await apiPost("/setup/led", params);

    if (result.ok) {
      clearStatus();
    } else {
      setStatus(result.data.error || "LED preview failed", "err");
    }
  } catch {
    setStatus("Network error", "err");
  }
}

// `looks` holds the color seen for each WS2812 wire byte; together they spell the RGB order.
export const ledMapping = {
  savedOrder: DEFAULT_ORDER,
  looks: [...DEFAULT_ORDER],
  remapOpen: false,

  get order() {
    return this.looks.join("");
  },

  get valid() {
    return RGB_ORDERS.includes(this.order);
  },

  applySavedOrder(order) {
    if (RGB_ORDERS.includes(order)) {
      this.savedOrder = order;
    }

    this.looks = [...this.savedOrder];
  },

  reset() {
    this.applySavedOrder(this.savedOrder);
    this.remapOpen = false;
    this.release();
  },

  release() {
    postQuietly("/setup/led", { byte: "off" });
  },

  render() {
    $("#setup-led-remap").hidden = !this.remapOpen;

    if (!this.remapOpen) {
      return;
    }

    for (const row of $$(".led-looks")) {
      const picked = this.looks[Number(row.dataset.ledByte)];

      for (const button of $$("[data-look]", row)) {
        button.classList.toggle("active", button.dataset.look === picked);
      }
    }

    $("#setup-led-map").replaceChildren(
      ...this.looks.map((channel) => {
        const chip = element("div", "led-chip-wrap");

        chip.append(
          element("div", `led-chip led-${channel.toLowerCase()}`),
          element("span", "led-chip-letter", channel),
        );

        return chip;
      }),
    );
  },
};

for (const button of $$("[data-led-color]")) {
  button.addEventListener("click", () => {
    if (isBusy()) {
      return;
    }

    const order = ledMapping.valid ? ledMapping.order : ledMapping.savedOrder;

    preview({ color: button.dataset.ledColor, rgb_order: order });
  });
}

$("#setup-led-remap-toggle").addEventListener("click", () => {
  ledMapping.remapOpen = true;
  ledMapping.render();
});

for (const button of $$(".led-light[data-led-byte]")) {
  button.addEventListener("click", () => {
    if (isBusy()) {
      return;
    }

    preview({ byte: button.dataset.ledByte });
  });
}

for (const button of $$(".led-looks [data-look]")) {
  button.addEventListener("click", () => {
    const byte = Number(button.closest(".led-looks").dataset.ledByte);

    ledMapping.looks[byte] = button.dataset.look;
    ledMapping.render();
    $("#setup-next").disabled = !ledMapping.valid;
  });
}
