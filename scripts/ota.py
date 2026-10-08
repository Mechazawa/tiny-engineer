Import("env")

import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

DEFAULT_HOST = "tiny-engineer.local"
REBOOT_TIMEOUT_S = 90
FIRMWARE_ATTEMPTS = 3


def ota_host():
    url = os.environ.get("TINY_ENGINEER_URL", "")
    # urlparse only finds a hostname after "//"; accept a bare host or IP too.
    host = urlparse(url if "//" in url else f"//{url}").hostname
    return host or DEFAULT_HOST


def espota(image, filesystem, check=True):
    command = [
        env.subst("$PYTHONEXE"),
        str(Path(env.PioPlatform().get_package_dir("framework-arduinoespressif32")) / "tools" / "espota.py"),
        "--ip", ota_host(),
        "--file", str(image),
        "--progress",
    ]

    token = os.environ.get("TINY_ENGINEER_TOKEN")

    if token:
        command += ["--auth", token]

    if filesystem:
        command.append("--spiffs")

    print(f"OTA {'filesystem' if filesystem else 'firmware'} -> {ota_host()}")
    return subprocess.run(command, check=check).returncode == 0


def wait_for_reboot():
    # The robot restarts after an OTA write; any HTTP answer (even 401) means it is back.
    time.sleep(5)
    deadline = time.monotonic() + REBOOT_TIMEOUT_S

    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(f"http://{ota_host()}/health", timeout=3)
            return
        except urllib.error.HTTPError:
            return
        except OSError:
            time.sleep(2)

    raise RuntimeError(f"{ota_host()} did not come back within {REBOOT_TIMEOUT_S} s")


def build_filesystem():
    project_dir = env.subst("$PROJECT_DIR")
    # The platform only wires up the LittleFS image builder when buildfs is a command-line target.
    subprocess.run(
        [env.subst("$PYTHONEXE"), "-m", "platformio", "run", "-t", "buildfs", "-e", env.subst("$PIOENV"), "-d", project_dir],
        check=True,
    )
    return env.subst("$BUILD_DIR/${ESP32_FS_IMAGE_NAME}.bin")


def upload_release(source, target, env):
    # Filesystem first: until the firmware follows, the robot keeps its old firmware and the
    # web UI refuses to load on the version mismatch instead of calling an older API.
    espota(build_filesystem(), filesystem=True)
    wait_for_reboot()

    # The OTA listener starts just after the HTTP server, so the first attempt can be early.
    for attempt in range(1, FIRMWARE_ATTEMPTS + 1):
        if espota(env.subst("$BUILD_DIR/${PROGNAME}.bin"), filesystem=False, check=attempt == FIRMWARE_ATTEMPTS):
            return
        time.sleep(3)


def upload_filesystem(source, target, env):
    espota(build_filesystem(), filesystem=True)


env.AddCustomTarget(
    name="ota",
    dependencies="$BUILD_DIR/${PROGNAME}.bin",
    actions=upload_release,
    title="Upload OTA",
    description="Upload filesystem, then firmware, over Wi-Fi",
)

env.AddCustomTarget(
    name="otafs",
    dependencies=None,
    actions=upload_filesystem,
    title="Upload Filesystem OTA",
    description="Upload LittleFS image over Wi-Fi",
)
