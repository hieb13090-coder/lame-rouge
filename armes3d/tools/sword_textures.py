"""Textures PBR procédurales pour les épées HD (numpy + Pillow).

Convention : images en espace image (ligne 0 = haut = v=1 en UV glTF).
Normal maps au format glTF (+X droite, +Y haut de l'image, OpenGL).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import sword_alphabet as AL


# ---------- bruit ----------

def _up(g, h, w, tile):
    if tile:
        g3 = np.tile(g, (3, 3)).astype(np.float32)
        a = np.asarray(Image.fromarray(g3).resize((w * 3, h * 3), Image.BICUBIC))
        return a[h:2 * h, w:2 * w]
    return np.asarray(Image.fromarray(g.astype(np.float32)).resize((w, h), Image.BICUBIC))


def fbm(shape, cells, rng, octs=5, tile=True):
    h, w = shape
    ch, cw = cells
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octs):
        g = rng.random((max(2, int(ch * 2 ** o)), max(2, int(cw * 2 ** o)))).astype(np.float32)
        out += amp * _up(g, h, w, tile)
        tot += amp
        amp *= 0.5
    out /= tot
    return norm(out)


def norm(a):
    a = a.astype(np.float32)
    return (a - a.min()) / max(float(a.max() - a.min()), 1e-9)


def to_img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def normal_map(height, k):
    gy, gx = np.gradient(height.astype(np.float32))
    nx, ny, nz = -gx * k, gy * k, np.ones_like(height, dtype=np.float32)
    l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return to_img(np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5)


def mr_map(rough, metal):
    return to_img(np.stack([np.ones_like(rough), rough, metal], -1))


def scratches(shape, rng, n, along_rows=True, length=(30, 400), spread=0.08, cross=0):
    h, w = shape
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    for i in range(n + cross):
        u0, v0 = rng.uniform(0, w), rng.uniform(0, h)
        ln = rng.uniform(*length)
        base = np.pi / 2 if along_rows else 0.0
        ang = base + (rng.normal(0, spread) if i < n else rng.uniform(-1.2, 1.2))
        d.line([(u0, v0), (u0 + ln * np.cos(ang), v0 + ln * np.sin(ang))], fill=int(rng.uniform(60, 255)), width=1)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float32) / 255.0


# ---------- texte en alphabet inventé, gravé dans la gouttière ----------

UNIT_M = 0.0075      # mètres par unité de grille du glyphe (glyphe = 15 mm x 30 mm)
STROKE_M = 0.0030    # épaisseur de trait


def draw_text(text, y0, spacing, perim, blade_len, W, H, ucs=(0.25, 0.75), scale=1.0):
    """Retourne une image float (H,W) avec le texte sur les deux faces (u=0.25 et u=0.75).
    Les lettres montent de la garde vers la pointe, la première à y0."""
    emis = np.zeros((H, W), np.float32)
    px = 0.0002
    cw, ch = int(0.030 * scale / px), int(0.044 * scale / px)
    unit_m, stroke_m = UNIT_M * scale, STROKE_M * scale ** 0.7
    y = y0
    for c in AL.normalize(text):
        if c == " ":
            y += spacing * 0.6
            continue
        cv = Image.new("L", (cw, ch), 0)
        AL.draw_glyph(ImageDraw.Draw(cv), c, cw / 2, ch / 2, unit_m / px, max(1, int(stroke_m / px)), 255)
        tw, th = max(2, round(0.030 * scale / perim * W)), max(2, round(0.044 * scale / blade_len * H))
        small = np.asarray(cv.resize((tw, th), Image.LANCZOS), dtype=np.float32) / 255.0
        row = int((1 - y / blade_len) * H)
        for uc in ucs:
            c0, r0 = int(uc * W - tw / 2), row - th // 2
            sl = (slice(r0, r0 + th), slice(c0, c0 + tw))
            emis[sl] = np.maximum(emis[sl], small)
        y += spacing
    return emis


def _glow(e, radius):
    g = np.asarray(Image.fromarray((np.clip(e, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255
    return g


# ---------- acier de la lame (version acier) ----------

def steel_textures(seed, perim_ref, blade_len, text, y0=0.20, spacing=0.046, W=512, H=2048):
    rng = np.random.default_rng(seed)
    streak = fbm((H, W), (5, W // 3), rng, octs=2, tile=False)
    stain = fbm((H, W), (10, 3), rng, octs=5, tile=False)
    pits = fbm((H, W), (90, 28), rng, octs=3, tile=False)
    pit = np.clip((pits - 0.80) * 7, 0, 1) * np.clip(stain - 0.35, 0, 1)
    scr = scratches((H, W), rng, 110, True, (40, 420), 0.05, cross=10)
    u = (np.arange(W) + 0.5) / W
    de = np.minimum.reduce([np.abs(u), np.abs(u - 0.5), np.abs(u - 1.0)])
    edge = np.repeat(np.exp(-de / 0.016)[None, :], H, 0)
    dirt = np.clip(stain - 0.58, 0, 1) * 1.8

    lum = 0.70 + 0.025 * (streak - 0.5) + 0.10 * scr + 0.12 * edge - 0.20 * dirt - 0.25 * pit
    base = np.stack([lum * 0.98, lum * 1.0, lum * 1.04], -1)
    rough = 0.30 + 0.05 * (streak - 0.5) + 0.22 * scr + 0.22 * dirt + 0.20 * pit - 0.06 * edge
    metal = 1.0 - 0.45 * dirt - 0.35 * pit
    height = 0.03 * (streak - 0.5) - 0.35 * scr - 0.40 * pit + 0.03 * stain

    runes = draw_text(text, y0, spacing, perim_ref, blade_len, W, H)
    glow = _glow(runes, 3.0)
    e = np.clip(runes + 0.55 * glow, 0, 1)
    emissive = e[..., None] * np.array([0.32, 0.85, 1.0])[None, None, :]
    base = base * (1 - 0.35 * np.clip(glow * 1.5, 0, 1))[..., None]
    height = height - 0.25 * runes                      # gravure légèrement en creux

    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.12, 1), np.clip(metal, 0, 1)),
                normal=normal_map(height, 7.0), emissive=to_img(emissive))


# ---------- acier noirci à veines de lave (version feu) ----------

def fire_steel_textures(seed, perim_ref, blade_len, text, y0=0.20, spacing=0.046, W=512, H=2048):
    rng = np.random.default_rng(seed)
    streak = fbm((H, W), (5, W // 3), rng, octs=2, tile=False)
    stain = fbm((H, W), (10, 3), rng, octs=5, tile=False)
    scr = scratches((H, W), rng, 130, True, (40, 420), 0.05, cross=14)
    u = (np.arange(W) + 0.5) / W
    de = np.minimum.reduce([np.abs(u), np.abs(u - 0.5), np.abs(u - 1.0)])
    edge = np.repeat(np.exp(-de / 0.012)[None, :], H, 0)           # tranchants polis
    soot = np.clip(stain - 0.42, 0, 1)
    rows = (np.arange(H)[:, None] / H).astype(np.float32)            # 0 = pointe, 1 = base
    near_tip = (1 - rows) ** 1.4

    lum = 0.09 + 0.02 * (streak - 0.5) + 0.12 * scr + 0.60 * edge * (0.6 + 0.4 * rows) - 0.03 * soot
    base = np.stack([lum * 1.05, lum, lum * 0.94], -1)
    rough = 0.42 + 0.10 * (streak - 0.5) + 0.25 * scr + 0.25 * soot - 0.22 * edge
    metal = 0.92 - 0.30 * soot

    # veines de lave : lignes de niveau d'un bruit, plus chaudes vers la pointe et près de la gouttière
    n1 = fbm((H, W), (16, 4), rng, octs=4, tile=False)
    n2 = fbm((H, W), (44, 11), rng, octs=3, tile=False)
    veins = np.exp(-((n1 - 0.5) / 0.014) ** 2) + 0.6 * np.exp(-((n2 - 0.5) / 0.010) ** 2)
    fu = (np.exp(-((u - 0.25) / 0.055) ** 2) + np.exp(-((u - 0.75) / 0.055) ** 2))[None, :]
    heat = 0.30 + 0.70 * near_tip
    lava = veins * heat * (0.30 + 0.70 * np.clip(fu * 1.6, 0, 1))
    channel = 0.30 * fu * (0.45 + 0.55 * near_tip)                    # gouttière incandescente
    tip_edge = 0.55 * edge * near_tip ** 1.6                           # tranchant rougeoyant près de la pointe
    e_lava = np.clip(lava + channel + tip_edge, 0, 1)

    runes = draw_text(text, y0, spacing, perim_ref, blade_len, W, H)
    glow = _glow(runes, 3.5)
    e_runes = np.clip(runes + 0.6 * glow, 0, 1)
    emissive = (e_lava[..., None] * 0.9 * np.array([1.0, 0.28, 0.04])[None, None, :]
                + e_runes[..., None] * np.array([1.0, 0.72, 0.25])[None, None, :])
    base = base * (1 - 0.5 * np.clip(e_lava, 0, 1))[..., None]
    height = 0.03 * (streak - 0.5) - 0.35 * scr - 0.30 * np.clip(veins, 0, 1) * 0.5 - 0.25 * runes

    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.12, 1), np.clip(metal, 0, 1)),
                normal=normal_map(height, 7.0), emissive=to_img(np.clip(emissive, 0, 1)))


# ---------- fer sombre martelé (garde, pommeau, bagues) ----------

def iron_textures(seed, S=512, fire=False):
    rng = np.random.default_rng(seed)
    hammer = fbm((S, S), (10, 10), rng, octs=4)
    fine = fbm((S, S), (60, 60), rng, octs=3)
    rust_n = fbm((S, S), (6, 6), rng, octs=5)
    scr = scratches((S, S), rng, 90, True, (20, 160), 1.3)
    if not fire:
        rust = np.clip((rust_n - 0.68) * 4, 0, 1) * np.clip(fine * 1.4, 0, 1)
        lum = 0.27 + 0.07 * (hammer - 0.5) + 0.04 * (fine - 0.5) + 0.12 * scr
        base = np.stack([lum, lum * 1.02, lum * 1.07], -1)
        base = base * (1 - rust[..., None]) + rust[..., None] * np.array([0.26, 0.13, 0.08])
        rough = 0.52 + 0.22 * (fine - 0.5) + 0.25 * scr + 0.30 * rust
        metal = 0.95 - 0.55 * rust
        height = 0.55 * hammer + 0.20 * fine - 0.5 * scr + 0.2 * rust
        return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.2, 1), np.clip(metal, 0, 1)),
                    normal=normal_map(height, 5.0))
    # version feu : fer noir, braises dans les creux
    ember = np.clip((rust_n - 0.62) * 5, 0, 1) * np.clip(fine * 1.5, 0, 1)
    crack = np.exp(-((fbm((S, S), (8, 8), rng, octs=4) - 0.5) / 0.016) ** 2)
    lum = 0.13 + 0.05 * (hammer - 0.5) + 0.03 * (fine - 0.5) + 0.10 * scr
    base = np.stack([lum * 1.02, lum, lum * 0.95], -1) * (1 - 0.6 * np.clip(ember + crack, 0, 1))[..., None]
    rough = 0.50 + 0.20 * (fine - 0.5) + 0.25 * scr
    metal = 0.9 - 0.3 * ember
    height = 0.55 * hammer + 0.20 * fine - 0.5 * scr - 0.25 * crack
    e = np.clip(0.55 * ember + 0.9 * crack, 0, 1)
    emissive = e[..., None] * np.array([1.0, 0.30, 0.05])[None, None, :]
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.2, 1), np.clip(metal, 0, 1)),
                normal=normal_map(height, 5.0), emissive=to_img(emissive))


# ---------- cuir cordé de la poignée ----------

def leather_textures(seed, grip_len, pitch, W=512, H=1024, tint=(0.42, 0.20, 0.12)):
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    y_rel = (np.arange(H) + 0.5) / H * grip_len
    phase = 2 * np.pi * (u[None, :] + y_rel[:, None] / pitch)
    ridge = (0.5 + 0.5 * np.cos(phase)) ** 2           # identique à la géométrie
    grain = fbm((H, W), (40, 20), rng, octs=4, tile=False)
    wear = fbm((H, W), (6, 3), rng, octs=4, tile=False)
    cav = 1 - ridge
    lum = 0.55 + 0.25 * (grain - 0.5) + 0.20 * (wear - 0.5) - 0.28 * cav
    base = np.stack([lum * tint[0], lum * tint[1], lum * tint[2]], -1)
    rough = 0.80 + 0.10 * (grain - 0.5) + 0.12 * cav - 0.15 * np.clip(wear - 0.6, 0, 1) * 2
    height = 0.8 * ridge + 0.25 * grain
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.3, 1), np.zeros((H, W), np.float32)),
                normal=normal_map(height, 9.0))
