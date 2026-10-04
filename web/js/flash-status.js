(() => {
  const OWNER = "jamro";
  const REPO = "tiny-engineer";
  const RELEASES_URL =
    "https://api.github.com/repos/" + OWNER + "/" + REPO + "/releases?per_page=30";

  const statusEl = document.getElementById("flash-status");
  const ledEl = document.getElementById("flash-led");
  const versionEl = document.getElementById("flash-version");
  const selectEl = document.getElementById("flash-release");
  const partsEl = document.getElementById("flash-parts");
  const manifestUrlEl = document.getElementById("flash-manifest-url");
  const installWrap = document.getElementById("flash-install");

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
  }

  function showInstall() {
    if (installWrap) installWrap.hidden = false;
  }

  function basename(path) {
    const clean = String(path || "").split("?")[0];
    const parts = clean.split("/");
    return parts[parts.length - 1] || clean;
  }

  function partLabel(path, tag) {
    let name = basename(path);
    const prefix = "tiny-engineer-" + tag + "-";
    if (tag && name.startsWith(prefix)) {
      name = name.slice(prefix.length);
    }
    return name.replace(/\.bin$/i, "") || name;
  }

  function formatOffset(offset) {
    const n = Number(offset);
    if (!Number.isFinite(n)) return String(offset);
    return "0x" + n.toString(16).toUpperCase();
  }

  function clearParts(message) {
    if (!partsEl) return;
    partsEl.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.className = "muted";
    td.textContent = message || "Select a release…";
    tr.appendChild(td);
    partsEl.appendChild(tr);
  }

  function renderParts(manifest, tag) {
    if (!partsEl) return;
    const parts =
      manifest &&
      manifest.builds &&
      manifest.builds[0] &&
      manifest.builds[0].parts;
    if (!Array.isArray(parts) || !parts.length) {
      clearParts("Manifest has no parts.");
      return;
    }
    partsEl.innerHTML = "";
    parts.forEach((part) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      const offTd = document.createElement("td");
      nameTd.textContent = partLabel(part.path, tag);
      offTd.textContent = formatOffset(part.offset);
      tr.appendChild(nameTd);
      tr.appendChild(offTd);
      partsEl.appendChild(tr);
    });
  }

  function remountInstallButton(manifestUrl) {
    if (!installWrap) return;
    installWrap.innerHTML = "";
    const btn = document.createElement("esp-web-install-button");
    btn.setAttribute("manifest", manifestUrl);
    const activate = document.createElement("button");
    activate.setAttribute("slot", "activate");
    activate.className = "btn btn-primary";
    activate.textContent = "Connect & install";
    btn.appendChild(activate);
    installWrap.appendChild(btn);
  }

  function selectedOption() {
    if (!selectEl || selectEl.selectedIndex < 0) return null;
    return selectEl.options[selectEl.selectedIndex];
  }

  function loadSelectedManifest() {
    const opt = selectedOption();
    if (!opt || !opt.value) {
      hideInstall();
      clearParts("Select a release…");
      if (manifestUrlEl) manifestUrlEl.textContent = "—";
      if (versionEl) versionEl.textContent = "—";
      return;
    }

    const tag = opt.dataset.tag || opt.textContent.replace(/\s*\(latest\)\s*$/, "");
    const manifestUrl = opt.value;
    if (manifestUrlEl) {
      manifestUrlEl.textContent = "releases/download/" + tag + "/manifest.json";
      manifestUrlEl.title = manifestUrl;
    }

    setStatus("warn", "Loading " + tag + " manifest…");
    hideInstall();
    clearParts("Loading…");

    fetch(manifestUrl, { method: "GET", cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("manifest " + res.status);
        return res.json();
      })
      .then((manifest) => {
        const version = manifest.version || tag;
        if (versionEl) versionEl.textContent = version;
        renderParts(manifest, tag);
        remountInstallButton(manifestUrl);
        showInstall();
        setStatus(
          "ok",
          "Release " + version + " ready. Plug in the C3, then install."
        );
      })
      .catch(() => {
        if (versionEl) versionEl.textContent = "—";
        clearParts("Could not load manifest.");
        hideInstall();
        setStatus(
          "err",
          "Could not load manifest for " + tag + ". Try another release."
        );
      });
  }

  function populateSelect(releases) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    releases.forEach((rel, index) => {
      const opt = document.createElement("option");
      opt.value = rel.manifestUrl;
      opt.dataset.tag = rel.tag;
      opt.textContent = index === 0 ? rel.tag + " (latest)" : rel.tag;
      selectEl.appendChild(opt);
    });
    selectEl.disabled = false;
  }

  if (!window.isSecureContext || !navigator.serial) {
    setStatus(
      "err",
      "Web Serial needs Chrome or Edge over HTTPS. Safari and Firefox will not cut it."
    );
    hideInstall();
    if (selectEl) {
      selectEl.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Web Serial unavailable";
      selectEl.appendChild(opt);
      selectEl.disabled = true;
    }
    clearParts("Web Serial unavailable");
    return;
  }

  setStatus("warn", "Loading flashable releases…");

  fetch(RELEASES_URL, {
    method: "GET",
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  })
    .then((res) => {
      if (!res.ok) throw new Error("releases " + res.status);
      return res.json();
    })
    .then((releases) => {
      const flashable = (Array.isArray(releases) ? releases : [])
        .filter((r) => r && !r.draft && !r.prerelease)
        .map((r) => {
          const asset = (r.assets || []).find((a) => a.name === "manifest.json");
          if (!asset) return null;
          const tag = r.tag_name;
          return {
            tag,
            manifestUrl:
              asset.browser_download_url ||
              "https://github.com/" +
                OWNER +
                "/" +
                REPO +
                "/releases/download/" +
                tag +
                "/manifest.json",
          };
        })
        .filter(Boolean);

      if (!flashable.length) {
        if (selectEl) {
          selectEl.innerHTML = "";
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "No flashable releases";
          selectEl.appendChild(opt);
          selectEl.disabled = true;
        }
        if (versionEl) versionEl.textContent = "—";
        if (manifestUrlEl) manifestUrlEl.textContent = "—";
        clearParts("No flashable releases yet");
        hideInstall();
        setStatus(
          "err",
          "No flashable releases yet. Publish a v* release with manifest.json, or backfill an older tag."
        );
        return;
      }

      populateSelect(flashable);
      if (selectEl) {
        selectEl.addEventListener("change", loadSelectedManifest);
      }
      loadSelectedManifest();
    })
    .catch(() => {
      if (selectEl) {
        selectEl.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Could not load releases";
        selectEl.appendChild(opt);
        selectEl.disabled = true;
      }
      if (versionEl) versionEl.textContent = "—";
      clearParts("Could not load releases");
      hideInstall();
      setStatus(
        "err",
        "Could not load GitHub releases. Check the network and try again."
      );
    });
})();
