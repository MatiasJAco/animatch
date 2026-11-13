#!/usr/bin/env python3
"""Regenerate the processed artwork assets from the committed source files.

Build-time only. Pillow is not a project dependency: nothing under `app/`, `server/`,
`tests/` or `e2e/` imports this module, and the processed assets are committed, so the
app builds, runs and deploys without Python (FR-033, Constitution VI).

The pipeline is deterministic — fixed crop windows, fixed resampling filter, fixed
encoder settings — so the same sources and the same Pillow version produce the same
bytes. `scripts/artwork/check.py --rebuild` relies on that.

    python3 scripts/artwork/build.py [--output-dir DIR]
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT / "artwork" / "sources"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "public"

# Seasonal card assets: a composed 16:9 image of the portrait source, resized and re-encoded.
# The window is 760 px tall so the frame reaches the character's waist; at 16:9 that canvas
# is wider than the 832 px source, so the lateral margins carry a blurred copy of the scene.
CARD_SIZE = (800, 450)
CARD_CROP_HEIGHT = 760
CARD_BACKDROP_BLUR = 16
CARD_FEATHER = 40
CARD_QUALITY = 78

# Mascot asset: the character cut out of its flat backdrop and re-encoded with alpha.
MASCOT_WIDTH = 640
MASCOT_QUALITY = 80
MATT_THRESHOLDS = (250, 244, 238, 232, 226, 220, 214, 208)
MATT_ALPHA_FLOOR = 128

SEASONAL_SOURCES: tuple[tuple[str, str, int], ...] = (
    # The window starts above the crown of the character's hair in every scene, so the
    # top of the head is never clipped: spring's hair begins at y≈172, summer's at y≈76,
    # autumn's at y≈102 and winter's at y≈0.
    ("matchi-spring.jpg", "games/match-the-series-spring-2026.webp", 120),
    ("matchi-summer.jpg", "games/match-the-series-summer-2026.webp", 40),
    ("matchi-autumn.jpg", "games/match-the-series-autumn-2026.webp", 60),
    ("matchi-winter.jpg", "games/match-the-series-winter-2026.webp", 0),
)

MASCOT_SOURCE = ("matchi-board.png", "artwork/matchi-mascot.webp")

# The two pre-existing illustrations are shipped unchanged and are not processed here.
PRE_EXISTING_ASSETS = ("games/more-or-less.svg", "games/groups.svg")


@dataclass(frozen=True)
class BuiltAsset:
    """One processed asset and the source it was derived from."""

    name: str
    path: Path
    source: Path
    size: tuple[int, int]
    bytes: int
    alpha: bool


def detect_format(path: Path) -> str:
    """Detect the container format from the file content, never from the extension.

    `matchi-board.png` carries JPEG data under a `.png` name, so anything that picks a
    decoder by suffix mis-decodes the mascot source (research R-001).
    """
    with path.open("rb") as handle:
        head = handle.read(16)
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    raise ValueError(f"{path}: unrecognised image format")


def _load_rgb(path: Path) -> Image.Image:
    """Open a source as RGB, after checking the content-detected format agrees."""
    detected = detect_format(path)
    with Image.open(path) as opened:
        if (opened.format or "").lower() != detected:
            raise ValueError(f"{path}: content says {detected}, decoder says {opened.format}")
        return opened.convert("RGB")


def _border_flood(mask: bytearray, width: int, height: int) -> None:
    """Mark every mask cell connected to the image border with 2.

    Connectivity, not brightness, decides what is background: the character's white coat
    and clipboard are enclosed by the drawing's outline, so the flood never reaches them
    (research R-005).
    """
    stack: list[tuple[int, int]] = []

    def push(x: int, y: int) -> None:
        index = y * width + x
        if mask[index] == 1:
            mask[index] = 2
            stack.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)

    while stack:
        x, y = stack.pop()
        row = y * width
        left = x
        while left > 0 and mask[row + left - 1] == 1:
            left -= 1
        right = x
        while right < width - 1 and mask[row + right + 1] == 1:
            right += 1
        for index in range(row + left, row + right + 1):
            mask[index] = 2
        for neighbour_y in (y - 1, y + 1):
            if not 0 <= neighbour_y < height:
                continue
            neighbour_row = neighbour_y * width
            for index in range(neighbour_row + left, neighbour_row + right + 1):
                if mask[index] == 1:
                    mask[index] = 2
                    stack.append((index - neighbour_row, neighbour_y))


def _build_alpha(image: Image.Image) -> Image.Image:
    """Build the mascot's alpha with a stacked border flood.

    For each whiteness threshold, the near-white region is flooded inward from the image
    border. A pixel reached at some threshold becomes partly transparent — more strongly
    the higher the threshold that reaches it — and a pixel never reached stays opaque.
    """
    width, height = image.size
    pixels = image.load()

    whiteness = bytearray(width * height)
    for y in range(height):
        row = y * width
        for x in range(width):
            red, green, blue = pixels[x, y]
            value = red if red < green else green
            if blue < value:
                value = blue
            whiteness[row + x] = value

    reached = bytearray(width * height)
    for threshold in MATT_THRESHOLDS:
        mask = bytearray(1 if value >= threshold else 0 for value in whiteness)
        _border_flood(mask, width, height)
        for index, cell in enumerate(mask):
            if cell == 2:
                reached[index] += 1

    total = len(MATT_THRESHOLDS)
    alpha = bytearray(width * height)
    for index in range(width * height):
        alpha[index] = (255 * (total - reached[index])) // total
    return Image.frombytes("L", (width, height), bytes(alpha))


def _unpremultiply(premultiplied: Image.Image, alpha: Image.Image) -> Image.Image:
    """Undo the premultiplication, so the saved colour is the character's own colour."""
    width, height = premultiplied.size
    alpha_values = alpha.load()
    channels: list[Image.Image] = []
    for channel in premultiplied.split():
        values = channel.load()
        restored = bytearray(width * height)
        for y in range(height):
            row = y * width
            for x in range(width):
                opacity = alpha_values[x, y]
                if opacity == 0:
                    continue
                restored[row + x] = min(255, (values[x, y] * 255 + opacity // 2) // opacity)
        channels.append(Image.frombytes("L", (width, height), bytes(restored)))
    return Image.merge("RGBA", (*channels, alpha))


def _build_mascot(source_path: Path, output_path: Path) -> tuple[tuple[int, int], bool]:
    """Cut the character out of its backdrop, trim it and resize it to 640 pixels wide."""
    rgb = _load_rgb(source_path)
    alpha = _build_alpha(rgb)

    # Trim to the character's bounding box. The faintest halo of the matte is below the
    # floor, so it is dropped with the padding around the character.
    bbox = alpha.point(lambda value: 255 if value >= MATT_ALPHA_FLOOR else 0).getbbox()
    if bbox is None:
        raise ValueError(f"{source_path}: no character found in the image")
    trimmed_rgb = rgb.crop(bbox)
    trimmed_alpha = alpha.crop(bbox)

    target_height = max(1, round(trimmed_alpha.height * MASCOT_WIDTH / trimmed_alpha.width))

    # Resizing in premultiplied space keeps the backdrop out of the character's edge, so
    # no light halo survives around the character in dark mode (FR-007).
    premultiplied = ImageChops.multiply(trimmed_rgb, trimmed_alpha.convert("RGB"))
    resized_alpha = trimmed_alpha.resize(
        (MASCOT_WIDTH, target_height), Image.Resampling.LANCZOS
    )
    resized_premultiplied = premultiplied.resize(
        (MASCOT_WIDTH, target_height), Image.Resampling.LANCZOS
    )
    rgba = _unpremultiply(resized_premultiplied, resized_alpha)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(output_path, "WEBP", quality=MASCOT_QUALITY)
    return rgba.size, True


def _build_seasonal(source_path: Path, output_path: Path, crop_y: int) -> tuple[tuple[int, int], bool]:
    """Compose the per-scene 16:9 card image, resize it and re-encode it.

    The source is a portrait illustration; the card band is landscape 16:9. A 16:9 window
    taken at the source's full width is only 468 px tall — 37 % of the source — which
    framed the character's head alone and cut the chin at the bottom edge.

    So the window is taller than the source is wide allows: at 760 px tall a 16:9 canvas
    is 1351 px wide, which is wider than the 832 px source. The scene is therefore
    composed, not merely cropped:

    - the foreground is the source region at its own scale (1:1), so the character is
      never stretched — it is framed from the crown of the head down to the waist, with
      the face large enough to read at card size;
    - the lateral margins are filled with the same scene, scaled to cover the canvas
      and blurred, so the colour and the setting carry through instead of a flat band.

    The result shows more of the character and more of the season than a plain crop,
    which is what the project owner asked for on 2026-11-13.
    """
    rgb = _load_rgb(source_path)
    width, height = rgb.size
    if crop_y + CARD_CROP_HEIGHT > height:
        raise ValueError(f"{source_path}: crop window at y={crop_y} does not fit {width}x{height}")

    canvas_width = CARD_CROP_HEIGHT * 16 // 9

    # Background: the whole scene scaled to cover the canvas, then blurred. It supplies
    # the colour and the atmosphere of the margins without competing with the figure.
    cover = max(canvas_width / width, CARD_CROP_HEIGHT / height) * 1.1
    backdrop = rgb.resize(
        (math.ceil(width * cover), math.ceil(height * cover)),
        Image.Resampling.LANCZOS,
    )
    left = (backdrop.width - canvas_width) // 2
    top = max(0, (backdrop.height - CARD_CROP_HEIGHT) // 3)
    backdrop = backdrop.crop(
        (left, top, left + canvas_width, top + CARD_CROP_HEIGHT)
    ).filter(ImageFilter.GaussianBlur(CARD_BACKDROP_BLUR))

    # Foreground: the source region at 1:1, centred on the canvas. Its edges are feathered
    # into the backdrop so the join reads as depth of field rather than as a pasted panel.
    foreground = rgb.crop((0, crop_y, width, crop_y + CARD_CROP_HEIGHT))
    mask = Image.new("L", foreground.size, 255)
    feather = CARD_FEATHER
    for column in range(feather + 1):
        value = int(255 * (column / feather) ** 2)
        mask.paste(value, (column, 0, column + 1, foreground.height))
        mask.paste(value, (foreground.width - 1 - column, 0, foreground.width - column, foreground.height))
    backdrop.paste(foreground, ((canvas_width - width) // 2, 0), mask)

    resized = backdrop.resize(CARD_SIZE, Image.Resampling.LANCZOS)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(output_path, "WEBP", quality=CARD_QUALITY)
    return resized.size, False


def build_all(output_dir: Path = DEFAULT_OUTPUT_DIR) -> list[BuiltAsset]:
    """Build every processed asset into `output_dir` and return what was written."""
    built: list[BuiltAsset] = []

    for source_name, asset_name, crop_y in SEASONAL_SOURCES:
        source_path = SOURCE_DIR / source_name
        output_path = output_dir / asset_name
        size, alpha = _build_seasonal(source_path, output_path, crop_y)
        built.append(
            BuiltAsset(
                name=asset_name,
                path=output_path,
                source=source_path,
                size=size,
                bytes=output_path.stat().st_size,
                alpha=alpha,
            )
        )

    source_name, asset_name = MASCOT_SOURCE
    source_path = SOURCE_DIR / source_name
    output_path = output_dir / asset_name
    size, alpha = _build_mascot(source_path, output_path)
    built.append(
        BuiltAsset(
            name=asset_name,
            path=output_path,
            source=source_path,
            size=size,
            bytes=output_path.stat().st_size,
            alpha=alpha,
        )
    )

    return built


def _print_table(built: list[BuiltAsset]) -> None:
    print(f"{'asset':<40} {'source':<22} {'dimensions':>12} {'bytes':>10}")
    print("-" * 88)
    for asset in built:
        dimensions = f"{asset.size[0]}x{asset.size[1]}"
        if asset.alpha:
            dimensions += " alpha"
        print(
            f"{asset.name:<40} {asset.source.name:<22} {dimensions:>12} {asset.bytes:>10,}"
        )
    print("-" * 88)
    print(f"{'total':<40} {'':<22} {'':>12} {sum(a.bytes for a in built):>10,}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="directory the processed assets are written to (default: public/)",
    )
    args = parser.parse_args(argv)

    missing = [name for name, _, _ in SEASONAL_SOURCES if not (SOURCE_DIR / name).exists()]
    if not (SOURCE_DIR / MASCOT_SOURCE[0]).exists():
        missing.append(MASCOT_SOURCE[0])
    if missing:
        parser.error(f"missing source artwork: {', '.join(sorted(missing))}")

    built = build_all(args.output_dir)
    _print_table(built)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
