(() => {
  const MANIFEST =
    "https://github.com/jamro/tiny-engineer/releases/latest/download/manifest.json";

  const statusEl = document.getElementById("flash-status");
  const ledEl = document.getElementById("flash-led");
  const versionEl = document.getElementById("flash-version");
  const installWrap = document.getElementById("flash-install");
  const installBtn = document.querySelector("esp-web-install-button");

  function setStatus(kind, text) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("is-ok", "is-err");
    if (kind === "ok") statusEl.classList.add("is-ok");
    if (kind === "err") statusEl.classList.add("is-err");
    if (ledEl) {
      ledEl.classList.remove("led-ok", "led-warn", "led-err");
      if (kind === "ok") ledEl.classList.add("led-ok");
      else if (kind === "err") ledEl.classList.add("led-err");
      else ledEl.classList.add("led-warn");
    }
  }

  function hideInstall() {
    if (installWrap) installWrap.hidden = true;
    if (installBtn) installBtn.setAttribute("hidden", "");
  }

  if (!window.isSecureContext || !navigator.serial) {
    setStatus(
      "err",
      "Web Serial needs Chrome or Edge over HTTPS. Safari and Firefox will not cut it."
    );
    hideInstall();
    return;
  }

  setStatus("warn", "Checking the latest firmware release…");

  fetch(MANIFEST, { method: "GET", cache: "no-store" })
    .then((res) => {
      if (!res.ok) {
        throw new Error("manifest " + res.status);
      }
      return res.json();
    })
    .then((manifest) => {
      if (versionEl) {
        versionEl.textContent = manifest.version || "latest";
      }
      setStatus(
        "ok",
        "Release " +
          (manifest.version || "latest") +
          " ready. Plug in the C3, then install."
      );
    })
    .catch(() => {
      if (versionEl) versionEl.textContent = "—";
      setStatus(
        "err",
        "No firmware release with a manifest yet. Tag a v* release, or flash with PlatformIO for now."
      );
      hideInstall();
    });
})();
