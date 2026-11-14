"""Textures PBR « réalistes » partagées (acier noirci, laiton/or vieilli, cuir de poignée).
Convention : ligne 0 de l'image = v=1. Normal maps glTF (OpenGL)."""
import numpy as np
from PIL import Image

from sword_textures import fbm, normal_map, mr_map, to_img, scratches


def _sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def pits(shape, rng, n, rmin=0.6, rmax=2.2):
    """Piqûres (petits creux ronds) : carte 0..1."""
    h, w = shape
    out = np.zeros((h, w), np.float32)
    ys, xs = rng.integers(0, h, n), rng.integers(0, w, n)
    rs = rng.uniform(rmin, rmax, n)
    yy, xx = np.mgrid[-4:5, -4:5]
    for y, x, r in zip(ys, xs, rs):
        k = np.exp(-(xx ** 2 + yy ** 2) / (r * r))
        y0, x0 = y - 4, x - 4
        sy, sx = slice(max(0, y0), min(h, y0 + 9)), slice(max(0, x0), min(w, x0 + 9))
        ky, kx = slice(sy.start - y0, sy.stop - y0), slice(sx.start - x0, sx.stop - x0)
        out[sy, sx] = np.maximum(out[sy, sx], k[ky, kx])
    return out


def dark_steel(seed, S=1024, lum=0.17, tint=(1.0, 1.0, 1.04), rough=0.40):
    """Acier noirci forgé : marbrures de calamine, rayures fines, piqûres."""
    rng = np.random.default_rng(seed)
    mott = fbm((S, S), (6, 6), rng, octs=5)
    fine = fbm((S, S), (60, 60), rng, octs=2)
    scr = np.asarray(scratches((S, S), rng, 260, along_rows=False, length=(20, 160), spread=0.6), np.float32)
    scr = scr / max(scr.max(), 1e-6)
    pt = pits((S, S), rng, 1400)
    l = lum * (0.82 + 0.36 * mott) + 0.05 * scr - 0.06 * pt
    base = np.stack([l * tint[0], l * tint[1], l * tint[2]], -1)
    r = rough + 0.14 * (mott - 0.5) - 0.12 * scr + 0.25 * pt + 0.04 * (fine - 0.5)
    h = 0.20 * mott + 0.05 * fine - 0.5 * pt - 0.15 * scr
    return dict(base=to_img(base), mr=mr_map(np.clip(r, 0.12, 0.9), np.full((S, S), 0.96, np.float32)), normal=normal_map(h, 3.0))


def aged_gold(seed, S=512, tint=(0.80, 0.58, 0.24), rough=0.30):
    """Or / laiton vieilli : poli, ternissure dans les zones de bruit, rayures fines."""
    rng = np.random.default_rng(seed)
    tarn = fbm((S, S), (5, 5), rng, octs=5)
    fine = fbm((S, S), (80, 80), rng, octs=2)
    scr = np.asarray(scratches((S, S), rng, 160, along_rows=False, length=(10, 90), spread=0.6), np.float32)
    scr = scr / max(scr.max(), 1e-6)
    k = 1.0 - 0.35 * _sstep(0.55, 0.85, tarn)
    base = np.stack([tint[0] * k, tint[1] * k, tint[2] * k * 0.95], -1) * (0.95 + 0.08 * scr[..., None])
    r = rough + 0.20 * _sstep(0.55, 0.85, tarn) + 0.04 * (fine - 0.5) - 0.08 * scr
    h = 0.05 * fine - 0.12 * scr
    return dict(base=to_img(base), mr=mr_map(np.clip(r, 0.1, 0.9), np.ones((S, S), np.float32)), normal=normal_map(h, 2.0))


def grip_leather(seed, W=512, H=1024, color=(0.060, 0.034, 0.022), seam_u=0.5, stitch=(0.16, 0.12, 0.08)):
    """Cuir de poignée tendu : grain, usure claire au milieu, couture longitudinale piquée (u=seam_u)."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    grain = fbm((H, W), (90, 45), rng, octs=3, tile=True)
    crease = fbm((H, W), (14, 6), rng, octs=4, tile=True)
    wear = fbm((H, W), (4, 3), rng, octs=4, tile=True)
    mid = np.exp(-((v - 0.5) / 0.28) ** 2)[:, None]
    du = np.abs(((u - seam_u + 0.5) % 1.0) - 0.5)[None, :]
    seam = np.exp(-(du / 0.010) ** 2)
    st_rows = ((v * 70) % 1.0)[:, None]
    stitch_m = ((np.abs(du - 0.016) < 0.006) | (np.abs(du + 0.0) < 0.0)).astype(np.float32) * (st_rows < 0.55)
    w = 1.0 + 0.55 * mid * _sstep(0.45, 0.8, wear) + 0.10 * (grain - 0.5) + 0.08 * (crease - 0.5)
    base = np.stack([color[0] * w, color[1] * w, color[2] * w], -1)
    base = base * (1 - 0.5 * seam[..., None]) * (1 - stitch_m[..., None]) + stitch_m[..., None] * np.array(stitch)
    r = 0.74 - 0.14 * mid * _sstep(0.45, 0.8, wear) + 0.08 * (grain - 0.5)
    h = 0.20 * grain + 0.25 * crease - 0.8 * seam + 0.6 * stitch_m
    return dict(base=to_img(base), mr=mr_map(np.clip(r, 0.25, 0.95), np.zeros((H, W), np.float32)), normal=normal_map(h, 3.5))


def etched(t, k=0.62):
    """Inscription gravée (non lumineuse) : assombrit la base et rend plus rugueux là où était l'émissif."""
    e = np.asarray(t["emissive"], np.float32).mean(-1, keepdims=True) / 255.0
    b = np.asarray(t["base"], np.float32) * (1 - k * np.clip(e * 1.5, 0, 1))
    mr = np.asarray(t["mr"], np.float32).copy()
    mr[..., 1:2] = np.clip(mr[..., 1:2] + 160 * np.clip(e * 1.5, 0, 1), 0, 255)
    return dict(base=Image.fromarray(b.astype(np.uint8)), mr=Image.fromarray(mr.astype(np.uint8)), normal=t["normal"])


def lacquer(seed, S=512, color=(0.035, 0.035, 0.038), rough=0.12, orange=0.04, metal=0.0):
    """Laque (urushi) ou corne polie : couleur unie, légère peau d'orange, micro-rayures de polissage."""
    rng = np.random.default_rng(seed)
    peel = fbm((S, S), (40, 40), rng, octs=3)
    swirl = fbm((S, S), (8, 8), rng, octs=4)
    scr = np.asarray(scratches((S, S), rng, 120, along_rows=False, length=(10, 80), spread=0.6), np.float32)
    scr = scr / max(scr.max(), 1e-6)
    k = 1.0 + 0.08 * (swirl - 0.5) + 0.25 * scr
    base = np.stack([color[0] * k, color[1] * k, color[2] * k], -1)
    r = rough + 0.04 * (swirl - 0.5) + 0.10 * scr
    return dict(base=to_img(base), mr=mr_map(np.clip(r, 0.05, 0.9), np.full((S, S), metal, np.float32)), normal=normal_map(orange * peel, 3.0))


def braid(seed, W=256, H=1024, color=(0.05, 0.05, 0.06), n=6, rough=0.75):
    """Cordon tressé plat (sageo) : chevrons de tresse le long de v."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    a = (np.abs(((u[None, :] * n) % 1.0) - 0.5) * 2)
    phase = (v[:, None] * 120 + a * 0.8) % 1.0
    strand = np.sin(np.pi * phase) ** 0.6
    grain = fbm((H, W), (60, 20), rng, octs=2, tile=True)
    k = 0.75 + 0.45 * strand + 0.1 * (grain - 0.5)
    base = np.stack([color[0] * k, color[1] * k, color[2] * k], -1)
    return dict(base=to_img(base), mr=mr_map(np.clip(rough - 0.1 * strand, 0.2, 1), np.zeros((H, W), np.float32)), normal=normal_map(0.8 * strand, 4.0))
