#!/usr/bin/env python3
"""
Generates src/icons/{16,32,48,128}.png.

Mark: three stacked bars, the top two fading out — a feed dissolving, leaving
one thing to focus on. Deliberately NOT a play button, not rounded-triangle,
and not red: Chrome Web Store trademark rules forbid anything confusable with
YouTube's own mark (see .claude/skills/cws-release).

Drawn at 8x and downsampled so the small sizes stay clean.

Run: python3 tools/gen-icons.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG = (17, 17, 19, 255)        # near-black, no brand colour
FG = (245, 245, 247, 255)     # off-white

SS = 8  # supersample factor


def rounded_bar(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render(size: int) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background plate
    rounded_bar(d, (0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=BG)

    # three bars: two faded (the feed going away), one solid (what you chose)
    pad_x = s * 0.22
    bar_h = s * 0.105
    radius = bar_h / 2
    gap = s * 0.105

    # vertically centre the stack of 3 bars
    total = bar_h * 3 + gap * 2
    top = (s - total) / 2

    specs = [
        (0.18, 0.50),   # (opacity, width fraction) — almost gone
        (0.45, 0.74),
        (1.00, 1.00),   # solid, full width — the one thing you chose
    ]

    for i, (alpha, wfrac) in enumerate(specs):
        y0 = top + i * (bar_h + gap)
        w = (s - pad_x * 2) * wfrac
        x0 = pad_x
        fill = (FG[0], FG[1], FG[2], int(255 * alpha))
        rounded_bar(d, (x0, y0, x0 + w, y0 + bar_h), radius=radius, fill=fill)

    return img.resize((size, size), Image.LANCZOS)


def main():
    for size in (16, 32, 48, 128):
        img = render(size)
        path = OUT / f"{size}.png"
        img.save(path, "PNG", optimize=True)
        print(f"wrote {path.relative_to(OUT.parent.parent)} ({path.stat().st_size} bytes)")

    # 440x280 small promo tile for the store listing
    tile = Image.new("RGBA", (440, 280), BG)
    icon = render(128).resize((112, 112), Image.LANCZOS)
    tile.alpha_composite(icon, (36, 84))
    d = ImageDraw.Draw(tile)
    d.text((172, 116), "Quiet", fill=FG)
    d.text((172, 140), "Distraction-free YouTube", fill=(150, 150, 155, 255))
    store = OUT.parent.parent / "store"
    store.mkdir(exist_ok=True)
    tile.convert("RGB").save(store / "promo-440x280.png", "PNG", optimize=True)
    print("wrote store/promo-440x280.png (placeholder — replace with real typography)")


if __name__ == "__main__":
    main()
