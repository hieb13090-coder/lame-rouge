"""Alphabet inventé « Sigil » : 26 glyphes sur une grille 2 x 4 (x 0..2, y 0..4, y vers le haut).

Grammaire : une colonne centrale (entière, haute ou basse) portant des branches obliques ou
horizontales à gauche / à droite, ou des figures libres (chevrons, losanges, triangles).
Chaque glyphe = liste de polylignes. L'ordre des glyphes suit A..Z (correspondance arbitraire).

Usage : python3 sword_alphabet.py <dossier_sortie>   -> alphabet_sigil.png + alphabet_sigil.json
"""
import json
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SPINE = {"full": [(1, 0), (1, 4)], "top": [(1, 2), (1, 4)], "bot": [(1, 0), (1, 2)]}
LEVEL = {"top": 3, "mid": 2, "low": 1}
DY = {"up": 1, "down": -1, "h": 0}


def _spine_glyph(spine, branches, extra=()):
    lines = [list(SPINE[spine])]
    for side, level, kind in branches:
        x_out = 0 if side == "L" else 2
        y = LEVEL[level]
        lines.append([(1, y), (x_out, y + DY[kind])])
    lines.extend([list(e) for e in extra])
    return lines


DIAMOND_MID = [(1, 3), (0, 2), (1, 1), (2, 2), (1, 3)]
DIAMOND_TOP = [(1, 4), (0, 3), (1, 2), (2, 3), (1, 4)]
DIAMOND_BOT = [(1, 2), (0, 1), (1, 0), (2, 1), (1, 2)]

GLYPHS = {
    "A": _spine_glyph("full", [("R", "top", "up"), ("L", "low", "down")]),
    "B": _spine_glyph("full", [("L", "top", "up"), ("R", "mid", "h")]),
    "C": _spine_glyph("full", [("R", "top", "down"), ("R", "low", "up")]),
    "D": _spine_glyph("full", [("L", "top", "down"), ("L", "low", "up")]),
    "E": _spine_glyph("full", [("R", "mid", "up"), ("L", "mid", "down")]),
    "F": _spine_glyph("full", [("L", "top", "h"), ("R", "low", "h")]),
    "G": _spine_glyph("full", [("R", "top", "h"), ("L", "mid", "h"), ("R", "low", "h")]),
    "H": _spine_glyph("full", [("L", "top", "up"), ("R", "top", "up")]),
    "I": _spine_glyph("full", [("L", "low", "down"), ("R", "low", "down")]),
    "J": _spine_glyph("full", [("R", "top", "up"), ("R", "mid", "up"), ("R", "low", "up")]),
    "K": _spine_glyph("top", [("L", "mid", "down"), ("R", "mid", "down")]),
    "L": _spine_glyph("top", [("L", "top", "up"), ("R", "top", "up")]),
    "M": _spine_glyph("bot", [("L", "low", "up"), ("R", "low", "up")], [[(0, 0), (2, 0)]]),
    "N": _spine_glyph("bot", [("L", "mid", "down"), ("R", "mid", "down")]),
    "O": [[(1, 4), (0, 2), (1, 0), (2, 2), (1, 4)]],
    "P": [[(0, 4), (1, 3), (2, 4)], [(0, 2), (1, 1), (2, 2)]],
    "Q": [[(0, 0), (2, 2), (0, 4)]],
    "R": [[(2, 0), (0, 2), (2, 4)]],
    "S": [[(0, 4), (2, 3), (0, 2), (2, 1), (0, 0)]],
    "T": [[(0, 0), (1, 4), (2, 0), (0, 0)]],
    "U": [[(0, 4), (1, 0), (2, 4), (0, 4)]],
    "V": _spine_glyph("full", [], [DIAMOND_MID]),
    "W": _spine_glyph("bot", [], [DIAMOND_TOP]),
    "X": _spine_glyph("top", [], [DIAMOND_BOT]),
    "Y": [[(0, 0), (0, 4)], [(2, 0), (2, 4)], [(0, 3), (2, 1)]],
    "Z": _spine_glyph("full", [("L", "top", "up"), ("R", "low", "down")]),
}
GLYPHS["Z"] = _spine_glyph("full", [("L", "top", "up"), ("R", "mid", "down"), ("L", "low", "h")])  # distinct de A


def normalize(text):
    s = unicodedata.normalize("NFD", text.upper())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(c if (c.isalpha() and c in GLYPHS) or c == " " else "" for c in s)


def draw_glyph(draw, ch, ox, oy, unit, width, fill):
    """Dessine le glyphe ch ; (ox, oy) = centre en pixels ; unit = pixels par unité de grille."""
    for line in GLYPHS[ch]:
        pts = [(ox + (x - 1) * unit, oy - (y - 2) * unit) for x, y in line]
        draw.line(pts, fill=fill, width=width, joint="curve")
        r = width / 2
        for p in pts:
            draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill)


def render_chart(path, sample="AURORE BRASIER"):
    cols, rows, cell = 7, 4, 230
    W, H = cols * cell, rows * cell + 170
    img = Image.new("RGB", (W, H), (14, 16, 22))
    glow = Image.new("L", (W, H), 0)
    d, dg = ImageDraw.Draw(img), ImageDraw.Draw(glow)
    font = ImageFont.load_default(size=30)
    small = ImageFont.load_default(size=26)
    for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        cx, cy = (i % cols) * cell + cell // 2, (i // cols) * cell + cell // 2 - 12
        draw_glyph(dg, ch, cx, cy, 26, 7, 255)
        draw_glyph(d, ch, cx, cy, 26, 5, (120, 215, 255))
        d.text((cx - 9, cy + 66), ch, fill=(150, 160, 175), font=font)
    img = Image.composite(Image.new("RGB", (W, H), (60, 140, 220)), img, glow.filter(ImageFilter.GaussianBlur(9)).point(lambda v: min(255, v // 2)))
    d = ImageDraw.Draw(img)
    for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        cx, cy = (i % cols) * cell + cell // 2, (i // cols) * cell + cell // 2 - 12
        draw_glyph(d, ch, cx, cy, 26, 5, (150, 225, 255))
        d.text((cx - 9, cy + 66), ch, fill=(150, 160, 175), font=font)
    # exemple
    x = 40
    d.text((x, rows * cell + 20), "Exemple :", fill=(150, 160, 175), font=small)
    x = 220
    for ch in normalize(sample):
        if ch == " ":
            x += 40
            continue
        draw_glyph(d, ch, x + 20, rows * cell + 95, 18, 4, (150, 225, 255))
        x += 62
    img.save(path)


def export_json(path):
    path.write_text(json.dumps({"grid": {"x": [0, 2], "y": [0, 4]}, "glyphs": {k: [[list(p) for p in line] for line in v] for k, v in GLYPHS.items()}}, indent=1))


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    render_chart(out / "alphabet_sigil.png")
    export_json(out / "alphabet_sigil.json")
    uniq = {tuple(map(tuple, sorted(map(tuple, g)))) for g in GLYPHS.values()}
    print("glyphes :", len(GLYPHS), "| formes distinctes :", len(uniq), "->", out)
