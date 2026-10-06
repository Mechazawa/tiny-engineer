import { $$ } from "./dom.js";
import { perform, setStatus } from "./status.js";

for (const button of $$("[data-test]")) {
  button.addEventListener("click", async () => {
    const result = await perform({
      path: button.dataset.test,
      pending: "Running…",
      failure: "Request failed",
    });

    if (result?.ok) {
      setStatus("Done.", "ok");
    }
  });
}
