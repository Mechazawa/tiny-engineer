import gzip
import shutil
from pathlib import Path


def pack_ui(source_dir, dest_dir):
    source_dir = Path(source_dir)
    dest_dir = Path(dest_dir)
    shutil.rmtree(dest_dir, ignore_errors=True)
    dest_dir.mkdir(parents=True)

    for source in sorted(source_dir.iterdir()):
        if not source.is_file() or source.name.startswith("."):
            continue
        # mtime=0 keeps the image byte-identical when sources are unchanged.
        packed = gzip.compress(source.read_bytes(), compresslevel=9, mtime=0)
        (dest_dir / f"{source.name}.gz").write_bytes(packed)
        print(f"Packed {source.name}: {source.stat().st_size} -> {len(packed)} bytes")
