#!/usr/bin/env python3
"""Verify every shipped artwork asset against the committed source it derives from.

Build-time only, like `build.py`: Pillow is not a project dependency and nothing under
`app/`, `server/`, `tests/` or `e2e/` imports this module (FR-033, Constitution VI).

    python3 scripts/artwork/check.py             # verify the committed assets
    python3 scripts/artwork/check.py --rebuild   # also rebuild them and compare bytes

`--rebuild` regenerates every asset into a temporary directory from the committed
sources and compares the bytes, which proves each committed file is exactly the
derivative the pipeline defines (FR-021, FR-022, SC-010).
"""

from __future__ import annotations

import argparse
import filecmp
import sys
import tempfile
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import (  # noqa: E402  (path is set up above)
    CARD_SIZE,
    DEFAULT_OUTPUT_DIR,
    MASCOT_SOURCE,
    MASCOT_WIDTH,
    PRE_EXISTING_ASSETS,
    SEASONAL_SOURCES,
    SOURCE_DIR,
    build_all,
    detect_format,
)

CARD_CEILING_BYTES = 90_000
MASCOT_CEILING_BYTES = 150_000
PAGE_BUDGET_BYTES = 450_000

# The mascot is 640 pixels wide with a height proportional to the trimmed composition of
# its source; the shipped asset measures 640x1137 pixels.
MASCOT_SIZE = (MASCOT_WIDTH, 1137)

# The winter scene is processed and stored beside the other seasonal assets, but no game
# maps to it and no page requests it (FR-020).
WINTER_ASSET = "games/match-the-series-winter-2026.webp"


class CheckFailure(Exception):
    """A contract rule the shipped assets do not satisfy."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise CheckFailure(message)


def _image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def _has_alpha(path: Path) -> bool:
    with Image.open(path) as image:
        return "A" in image.getbands()


def _source_pairs() -> list[tuple[str, Path, Path]]:
    """(asset name, source path, shipped path) for every processed asset."""
    pairs = [
        (asset_name, SOURCE_DIR / source_name, DEFAULT_OUTPUT_DIR / asset_name)
        for source_name, asset_name, _ in SEASONAL_SOURCES
    ]
    pairs.append(
        (MASCOT_SOURCE[1], SOURCE_DIR / MASCOT_SOURCE[0], DEFAULT_OUTPUT_DIR / MASCOT_SOURCE[1])
    )
    return pairs


def verify_asset(asset_name: str, source_path: Path, asset_path: Path) -> list[str]:
    """Check one shipped asset against its source and its class ceiling."""
    notes: list[str] = []

    _require(source_path.exists(), f"missing source artwork: {source_path}")
    _require(asset_path.exists(), f"missing processed asset: {asset_path}")

    source_bytes = source_path.stat().st_size
    asset_bytes = asset_path.stat().st_size

    _require(
        asset_bytes < source_bytes,
        f"{asset_name}: {asset_bytes:,} bytes is not smaller than its source "
        f"({source_bytes:,} bytes)",
    )
    _require(
        not filecmp.cmp(source_path, asset_path, shallow=False),
        f"{asset_name}: is a byte-for-byte copy of its source",
    )

    detected = detect_format(asset_path)
    _require(detected == "webp", f"{asset_name}: expected WebP, found {detected}")

    size = _image_size(asset_path)
    is_mascot = asset_name == MASCOT_SOURCE[1]

    if is_mascot:
        _require(
            size == MASCOT_SIZE,
            f"{asset_name}: expected {MASCOT_SIZE[0]}x{MASCOT_SIZE[1]}, found {size[0]}x{size[1]}",
        )
        _require(_has_alpha(asset_path), f"{asset_name}: has no alpha channel")
        _require(
            asset_bytes <= MASCOT_CEILING_BYTES,
            f"{asset_name}: {asset_bytes:,} bytes exceeds the {MASCOT_CEILING_BYTES:,} byte ceiling",
        )
        notes.append(f"{asset_name}: {size[0]}x{size[1]} alpha, {asset_bytes:,} bytes")
    else:
        _require(
            size == CARD_SIZE,
            f"{asset_name}: expected {CARD_SIZE[0]}x{CARD_SIZE[1]}, found {size[0]}x{size[1]}",
        )
        _require(
            not _has_alpha(asset_path),
            f"{asset_name}: a card asset must not carry an alpha channel",
        )
        _require(
            asset_bytes <= CARD_CEILING_BYTES,
            f"{asset_name}: {asset_bytes:,} bytes exceeds the {CARD_CEILING_BYTES:,} byte ceiling",
        )
        notes.append(f"{asset_name}: {size[0]}x{size[1]}, {asset_bytes:,} bytes")

    notes.append(f"    source {source_path.name}: {source_bytes:,} bytes")
    return notes


def verify_source_coverage() -> list[str]:
    """Every source has exactly one derived asset, and every derived asset one source."""
    pairs = _source_pairs()
    sources = [source for _, source, _ in pairs]
    assets = [asset for _, _, asset in pairs]

    _require(
        len(set(sources)) == len(sources),
        "a source artwork is used by more than one processed asset",
    )
    _require(
        len(set(assets)) == len(assets),
        "a processed asset is derived from more than one source",
    )

    expected = {source.name for source in sources}
    on_disk = {path.name for path in SOURCE_DIR.iterdir() if path.is_file()}
    _require(
        on_disk == expected,
        f"artwork/sources/ holds {sorted(on_disk)}, expected {sorted(expected)}",
    )

    served = DEFAULT_OUTPUT_DIR.resolve()
    for source in sources:
        _require(
            served not in source.resolve().parents,
            f"{source} sits inside the served directory",
        )
    return [f"artwork/sources/: {len(sources)} sources, each with exactly one derived asset"]


def verify_page_budget() -> list[str]:
    """The set the home page actually serves stays inside the page budget."""
    served = [
        DEFAULT_OUTPUT_DIR / asset_name
        for _, asset_name, _ in SEASONAL_SOURCES
        if asset_name != WINTER_ASSET
    ]
    served.append(DEFAULT_OUTPUT_DIR / MASCOT_SOURCE[1])
    served.extend(DEFAULT_OUTPUT_DIR / name for name in PRE_EXISTING_ASSETS)

    total = 0
    for path in served:
        _require(path.exists(), f"missing served asset: {path}")
        total += path.stat().st_size

    _require(
        total <= PAGE_BUDGET_BYTES,
        f"the home page serves {total:,} bytes, over the {PAGE_BUDGET_BYTES:,} byte budget",
    )
    return [f"home page artwork: {total:,} bytes of the {PAGE_BUDGET_BYTES:,} byte budget"]


def verify_reserved_winter() -> list[str]:
    """The winter scene is stored, but it is not part of the page budget."""
    path = DEFAULT_OUTPUT_DIR / WINTER_ASSET
    _require(path.exists(), f"missing reserved asset: {path}")
    size = _image_size(path)
    _require(
        size == CARD_SIZE,
        f"{WINTER_ASSET}: expected {CARD_SIZE[0]}x{CARD_SIZE[1]}, found {size[0]}x{size[1]}",
    )
    return [f"{WINTER_ASSET}: stored, reserved, {path.stat().st_size:,} bytes"]


def verify_rebuild() -> list[str]:
    """Rebuild every asset from the committed sources and compare the bytes."""
    notes: list[str] = []
    with tempfile.TemporaryDirectory(prefix="animatch-artwork-") as temporary:
        rebuilt_dir = Path(temporary)
        build_all(rebuilt_dir)
        for _, _, asset_path in _source_pairs():
            rebuilt = rebuilt_dir / asset_path.relative_to(DEFAULT_OUTPUT_DIR)
            _require(rebuilt.exists(), f"rebuild did not produce {rebuilt.name}")
            _require(
                filecmp.cmp(asset_path, rebuilt, shallow=False),
                f"{asset_path.name}: the committed file differs from a rebuild of the sources",
            )
            notes.append(f"{asset_path.name}: byte-identical to a rebuild")
    return notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="regenerate the assets into a temporary directory and compare the bytes",
    )
    args = parser.parse_args(argv)

    lines: list[str] = []
    try:
        lines.extend(verify_source_coverage())
        for asset_name, source_path, asset_path in _source_pairs():
            lines.extend(verify_asset(asset_name, source_path, asset_path))
        lines.extend(verify_reserved_winter())
        lines.extend(verify_page_budget())
        if args.rebuild:
            lines.extend(verify_rebuild())
    except CheckFailure as failure:
        print(f"FAIL  {failure}")
        return 1

    for line in lines:
        print(line)
    print("OK    every shipped asset is a smaller, re-encoded derivative of one committed source")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
