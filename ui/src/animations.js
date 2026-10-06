import { apiGetJson } from "./api.js";
import { $, $$ } from "./dom.js";
import { perform, setStatus } from "./status.js";

const currentAnimation = $("#anim-current strong");

export async function refreshAnimation() {
  try {
    const anim = await apiGetJson("/anim");

    if (anim.ok) {
      currentAnimation.textContent = anim.animation;
    }
  } catch {
    // The badge keeps its last value.
  }
}

for (const button of $$("[data-anim]")) {
  button.addEventListener("click", async () => {
    const result = await perform({
      path: "/anim",
      params: { name: button.dataset.anim },
      pending: "Setting animation…",
      failure: "Failed",
    });

    if (!result?.ok) {
      return;
    }

    setStatus(`Animation: ${result.data.animation}`, "ok");
    currentAnimation.textContent = result.data.animation;
  });
}
