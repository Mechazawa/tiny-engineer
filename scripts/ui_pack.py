import gzip
import shutil
import subprocess
from pathlib import Path


class UiPackError(Exception):
    pass


def _npm(ui_dir, *args):
    npm = shutil.which("npm")
    if npm is None:
        raise UiPackError("npm not found; building the web UI needs Node 20.19+")
    subprocess.run([npm, *args], cwd=ui_dir, check=True)


def build_ui(ui_dir):
    ui_dir = Path(ui_dir)
    # npm writes this marker on install; an older one means the lockfile changed since.
    installed = ui_dir / "node_modules" / ".package-lock.json"
    lockfile = ui_dir / "package-lock.json"
    if not installed.is_file() or installed.stat().st_mtime < lockfile.stat().st_mtime:
        _npm(ui_dir, "ci")
    _npm(ui_dir, "run", "build")
    return ui_dir / "dist"


def pack_ui(dist_dir, dest_dir):
    dist_dir = Path(dist_dir)
    dest_dir = Path(dest_dir)
    shutil.rmtree(dest_dir, ignore_errors=True)

    for source in sorted(path for path in dist_dir.rglob("*") if path.is_file()):
        name = source.relative_to(dist_dir)
        dest = dest_dir / f"{name}.gz"
        dest.parent.mkdir(parents=True, exist_ok=True)
        # mtime=0 keeps the image byte-identical when sources are unchanged.
        packed = gzip.compress(source.read_bytes(), compresslevel=9, mtime=0)
        dest.write_bytes(packed)
        print(f"Packed {name}: {source.stat().st_size} -> {len(packed)} bytes")
