"""Textures PBR du naginata (lame trempée avec hamon, métal doré, hampe laquée).

Mêmes conventions que sword_textures : image ligne 0 = haut = v=1, normales glTF (+Y haut).
"""
import numpy as np
from PIL import Image

import sword_textures as TX
from sword_textures import fbm, norm, normal_map, mr_map, scratches, to_img, _glow


def smooth1d(rng, n, cells):
    g = rng.random(cells + 4).astype(np.float32)
    x = np.linspace(1, cells + 1, n)
    i = np.floor(x).astype(int)
    f = (x - i)
    p0, p1, p2, p3 = g[i - 1], g[i], g[i + 1], g[i + 2]
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blade_textures(seed, uref, perim_ref, blade_len, text, y0=0.15, spacing=0.031, W=512, H=2048, sc=0.50, groove=True):
    """uref : dict avec 'ham' (limite moyenne du hamon), 'ridge', 'g0', 'g1' (bords de la gouttière), 'text' (u du texte)."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    uu = np.minimum(u, 1 - u)[None, :]                      # distance au tranchant (0..0.5)
    rows = (np.arange(H) + 0.5) / H                        # 0 = pointe, 1 = base
    t = (1 - rows)[:, None]

    hada = fbm((H, W), (9, 60), rng, octs=3, tile=False)       # grain du métal replié
    hada2 = fbm((H, W), (40, 220), rng, octs=2, tile=False)
    stain = fbm((H, W), (9, 3), rng, octs=5, tile=False)
    scr = scratches((H, W), rng, 70, True, (40, 300), 0.03, cross=0)

    # ligne de trempe (hamon) ondulée, avec des cimes irrégulières
    bnd = (uref["ham"] + 0.010 * (smooth1d(rng, H, 38) - 0.5) * 2 + 0.007 * np.sin(2 * np.pi * (t[:, 0] * 23) + 1.3)
           + 0.004 * np.sin(2 * np.pi * (t[:, 0] * 61) + 0.4))[:, None]
    ham = sstep(bnd + 0.0045, bnd - 0.0045, uu)                  # 1 dans la zone trempée
    nie = np.clip((fbm((H, W), (160, 90), rng, octs=2, tile=False) - 0.72) * 6, 0, 1) * np.exp(-((uu - bnd) / 0.012) ** 2)
    edge = np.exp(-uu / 0.006)
    body_hi = sstep(uref["ridge"] - 0.01, uref["ridge"] + 0.01, uu)      # zone au-dessus du shinogi (plus mate)
    gv = np.exp(-((uu - 0.5 * (uref["g0"] + uref["g1"])) / (0.5 * (uref["g1"] - uref["g0"]))) ** 8)

    lum = (0.27 + 0.035 * (hada - 0.5) + 0.03 * (hada2 - 0.5) + 0.10 * scr - 0.10 * np.clip(stain - 0.55, 0, 1)
           - 0.05 * body_hi + 0.05 * (groove - 1) * gv + ham * (0.40 + 0.05 * (hada2 - 0.5)) + 0.22 * nie + 0.18 * edge + 0.05 * gv)
    base = np.stack([lum * 0.97, lum * 0.99, lum * 1.03], -1)
    rough = (0.34 + 0.06 * (hada - 0.5) + 0.22 * scr + 0.10 * body_hi - 0.16 * ham - 0.08 * edge
             + 0.12 * np.clip(stain - 0.6, 0, 1))
    metal = 1.0 - 0.25 * np.clip(stain - 0.62, 0, 1)

    r0 = uref["ridge"]
    height = (0.05 * (hada - 0.5) - 0.35 * scr
              + 0.9 * np.exp(-((uu - r0) / 0.0065) ** 2)               # arête du shinogi
              - 0.8 * groove * (np.exp(-((uu - uref["g0"]) / 0.0055) ** 2) + np.exp(-((uu - uref["g1"]) / 0.0055) ** 2))
              + 0.12 * ham)

    runes = TX.draw_text(text, y0, spacing, perim_ref, blade_len, W, H,
                         ucs=(uref["text"], 1 - uref["text"]), scale=sc)
    glow = _glow(runes, 2.5)
    e = np.clip(runes + 0.5 * glow, 0, 1)
    emissive = e[..., None] * np.array([1.0, 0.95, 0.85])[None, None, :]      # blanc chaud, neutre (sans élément)
    base = base * (1 - 0.30 * np.clip(glow * 1.5, 0, 1))[..., None]
    height = height - 0.30 * runes

    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.1, 1), np.clip(metal, 0, 1)),
                normal=normal_map(height, 9.0), emissive=to_img(emissive))


def gilt_textures(seed, S=512, tint=(0.80, 0.58, 0.22)):
    """Bronze doré patiné (tsuba, habaki, bagues)."""
    rng = np.random.default_rng(seed)
    hammer = fbm((S, S), (9, 9), rng, octs=4)
    fine = fbm((S, S), (70, 70), rng, octs=3)
    pat = fbm((S, S), (5, 5), rng, octs=5)
    scr = scratches((S, S), rng, 30, True, (20, 90), 1.3)
    u = (np.arange(S) + 0.5) / S
    waves = (0.5 + 0.5 * np.sin(2 * np.pi * (u[None, :] * 24 + 2.0 * (hammer - 0.5))))   # vagues gravées (seigaiha)
    dark = np.clip((pat - 0.55) * 3, 0, 1)
    lum = 0.80 + 0.10 * (hammer - 0.5) + 0.10 * scr - 0.40 * dark - 0.05 * waves
    base = np.stack([lum * tint[0], lum * tint[1], lum * tint[2]], -1)
    rough = 0.34 + 0.18 * (fine - 0.5) + 0.25 * scr + 0.30 * dark
    metal = 1.0 - 0.40 * dark
    height = 0.10 * hammer + 0.05 * fine - 0.12 * scr - 0.22 * waves
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.15, 1), np.clip(metal, 0, 1)),
                normal=normal_map(height, 2.5))


def pole_textures(seed, length, pitch=0.16, W=256, H=2048):
    """Laque noire (urushi) à poussière d'or et fine spirale dorée incrustée."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    y = (1 - (np.arange(H) + 0.5) / H) * length            # ligne 0 = haut de la hampe
    grain = fbm((H, W), (6, 3), rng, octs=3, tile=True)
    wood = fbm((H, W), (30, 4), rng, octs=3, tile=True)
    phase = u[None, :] + y[:, None] / pitch
    fr = phase - np.floor(phase)
    spiral = np.exp(-((fr - 0.5) / 0.010) ** 2)
    spiral2 = 0.5 * np.exp(-((fr - 0.5 + 0.06) / 0.004) ** 2)
    dust = (rng.random((H, W)) > 0.9965).astype(np.float32)
    dust = np.asarray(Image.fromarray((dust * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.float32) / 255
    dust = np.clip(dust * 4, 0, 1) * np.clip(grain - 0.35, 0, 1)
    gold = np.clip(spiral + spiral2 + dust, 0, 1)
    lum = 0.030 + 0.012 * (grain - 0.5) + 0.006 * (wood - 0.5)
    black = np.stack([lum * 1.05, lum * 0.95, lum * 0.92], -1)
    gold_c = np.array([0.78, 0.55, 0.20])[None, None, :]
    base = black * (1 - gold[..., None]) + gold_c * gold[..., None]
    rough = 0.20 + 0.06 * (grain - 0.5) + 0.20 * gold
    metal = 0.95 * gold
    height = 0.04 * (wood - 0.5) + 0.25 * gold
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.1, 1), metal), normal=normal_map(height, 4.0))


def tsuka_textures(seed, length, n, p, W=512, H=1024, cord=(0.035, 0.045, 0.085), weave=0.0, nodules=False, cpow=3.0):
    """Poignée de katana : peau de raie perlée (samegawa) sous un tressage en losanges (tsukamaki).
    Même formule de phase que la géométrie : phase = n*u -/+ y/p, y mesuré depuis le haut."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    y = (np.arange(H) + 0.5) / H * length
    pa = n * u[None, :] + y[:, None] / p
    pb = n * u[None, :] - y[:, None] / p
    ra = (0.5 + 0.5 * np.cos(2 * np.pi * pa)) ** cpow
    rb = (0.5 + 0.5 * np.cos(2 * np.pi * pb)) ** cpow
    ridge = np.maximum(ra, rb)
    mask = sstep(0.22, 0.34, ridge) if cpow > 2 else sstep(0.40, 0.50, ridge)
    # perles de samegawa : grille de bosses
    gx, gy = (u[None, :] * 80) % 1.0, (y[:, None] / 0.0045) % 1.0
    pearl = np.clip(1 - 3.2 * ((gx - 0.5) ** 2 + (gy - 0.5) ** 2), 0, 1)
    grain = fbm((H, W), (30, 20), rng, octs=3, tile=True)
    wear = fbm((H, W), (5, 3), rng, octs=4, tile=True)
    ray = 0.62 + 0.10 * pearl + 0.06 * (grain - 0.5)
    ray_c = np.stack([ray * 0.97, ray * 0.96, ray * 0.90], -1)
    if nodules:                                       # perles irrégulières (vraie peau de raie)
        from forge_tex import pits
        pearl = pits((H, W), rng, int(H * W / 90), rmin=1.2, rmax=2.6)
        ray = 0.66 + 0.12 * pearl + 0.06 * (grain - 0.5)
        ray_c = np.stack([ray * 0.97, ray * 0.95, ray * 0.88], -1)
    wv = 0.5 + 0.5 * np.sin(2 * np.pi * np.where(ra >= rb, pb, pa) * 7.0)     # torsion du cordon de soie
    cl = 0.9 + 0.35 * (grain - 0.5) + 0.2 * (wear - 0.5) - 0.35 * (1 - ridge) + weave * (wv - 0.5)
    cord_c = np.stack([cl * cord[0], cl * cord[1], cl * cord[2]], -1)
    base = ray_c * (1 - mask[..., None]) + cord_c * mask[..., None]
    rough = 0.45 * (1 - mask) + 0.78 * mask + 0.06 * (grain - 0.5)
    height = 0.9 * ridge * mask + 0.25 * pearl * (1 - mask) + 0.15 * grain + 0.25 * weave * wv * mask
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.2, 1), np.zeros((H, W), np.float32)),
                normal=normal_map(height, 6.0))


# ---------------- textures des armes suivantes ----------------

def double_blade_textures(seed, style, blade_len, W=256, H=1024):
    """Lame symétrique à deux tranchants. u=0 et u=0.5 = tranchants, u=0.25/0.75 = arête centrale.
    style : 'mirror' (acier poli blanc, filet lumineux), 'pamor' (acier damassé bleui), 'black' (acier noirci, biseaux polis)."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    ue = np.abs(((u + 0.25) % 0.5) - 0.25)[None, :]            # distance au tranchant le plus proche (0..0.25)
    rows = (np.arange(H) + 0.5) / H
    t = (1 - rows)[:, None]
    streak = fbm((H, W), (4, 70), rng, octs=3, tile=False)
    fine = fbm((H, W), (50, 120), rng, octs=2, tile=False)
    stain = fbm((H, W), (8, 3), rng, octs=5, tile=False)
    scr = scratches((H, W), rng, 40, True, (40, 300), 0.04, cross=0)
    edge = np.exp(-ue / 0.012)
    ridge = np.exp(-(np.abs(ue - 0.25)) / 0.010)
    emissive = None
    if style == "mirror":
        lum = 0.80 + 0.04 * (streak - 0.5) + 0.06 * scr + 0.12 * edge - 0.10 * np.clip(stain - 0.6, 0, 1) + 0.05 * ridge
        base = np.stack([lum * 0.97, lum * 0.98, lum * 1.0], -1)
        rough = 0.22 + 0.05 * (streak - 0.5) + 0.18 * scr + 0.10 * np.clip(stain - 0.6, 0, 1)
        metal = np.ones((H, W), np.float32)
        height = 0.04 * (streak - 0.5) - 0.2 * scr + 0.5 * ridge
        dash = (np.sin(2 * np.pi * t * (blade_len / 0.022)) > -0.2).astype(np.float32)   # filet lumineux en tirets
        line = np.exp(-(np.abs(ue - 0.25) / 0.010) ** 2) * dash * sstep(0.04, 0.12, t) * (1 - sstep(0.80, 0.93, t))
        emissive = to_img(line[..., None] * np.array([1.0, 0.86, 0.55])[None, None, :])
    elif style == "pamor":
        w = fbm((H, W), (14, 5), rng, octs=4, tile=False)
        bands = 0.5 + 0.5 * np.sin(2 * np.pi * (w * 9.0 + t * 2.0))
        bands = sstep(0.35, 0.65, bands)
        lum = 0.17 + 0.24 * bands + 0.05 * (fine - 0.5) + 0.05 * scr + 0.20 * edge
        base = np.stack([lum * 0.86, lum * 0.94, lum * 1.08], -1)
        rough = 0.30 + 0.22 * (1 - bands) + 0.15 * scr - 0.14 * edge
        metal = np.ones((H, W), np.float32)
        height = 0.30 * bands + 0.04 * fine - 0.2 * scr + 0.4 * ridge
    else:   # black
        lum = 0.06 + 0.02 * (fine - 0.5) + 0.04 * scr + 0.50 * edge + 0.06 * np.clip(stain - 0.55, 0, 1)
        base = np.stack([lum * 0.95, lum * 0.98, lum * 1.05], -1)
        rough = 0.42 + 0.08 * (fine - 0.5) + 0.20 * scr - 0.28 * edge
        metal = np.ones((H, W), np.float32) * 0.9
        height = 0.03 * (fine - 0.5) - 0.2 * scr + 0.5 * ridge
    out = dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.08, 1), metal), normal=normal_map(height, 6.0))
    if emissive is not None:
        out["emissive"] = emissive
    return out


def wood_textures(seed, S=512, tint=(0.07, 0.04, 0.03)):
    rng = np.random.default_rng(seed)
    grain = fbm((S, S), (3, 40), rng, octs=4, tile=True)
    rings = 0.5 + 0.5 * np.sin(2 * np.pi * (grain * 7))
    fine = fbm((S, S), (60, 60), rng, octs=2, tile=True)
    lum = 0.8 + 0.5 * (rings - 0.5) + 0.2 * (fine - 0.5)
    base = np.stack([lum * tint[0], lum * tint[1], lum * tint[2]], -1)
    rough = 0.40 + 0.12 * (fine - 0.5)
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.15, 1), np.zeros((S, S), np.float32)),
                normal=normal_map(0.4 * rings + 0.2 * fine, 3.0))


def hammer_head_textures(seed, W=512, H=512, cells_u=16, cells_v=4.5):
    """Fer sombre martelé ; bande centrale gravée d'un tressage (V=1 -> bout, bande entre v=0.31 et 0.69)."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    v = 1 - (np.arange(H) + 0.5) / H
    hammer = fbm((H, W), (14, 28), rng, octs=4, tile=True)
    fine = fbm((H, W), (90, 180), rng, octs=3, tile=True)
    scr = scratches((H, W), rng, 70, True, (30, 200), 0.3, cross=6)
    wear = fbm((H, W), (6, 12), rng, octs=5, tile=True)
    in_band = sstep(0.30, 0.32, v) * (1 - sstep(0.68, 0.70, v))
    pv = (v - 0.31) / 0.38 * cells_v
    pu = u * cells_u
    pa = pu[None, :] + pv[:, None]
    pb = pu[None, :] - pv[:, None]
    ra = (0.5 + 0.5 * np.cos(2 * np.pi * pa)) ** 3
    rb = (0.5 + 0.5 * np.cos(2 * np.pi * pb)) ** 3
    knot = np.maximum(ra, rb) * in_band[:, None]
    border = np.exp(-((v - 0.305) / 0.006) ** 2) + np.exp(-((v - 0.695) / 0.006) ** 2)
    border = border[:, None] * np.ones((1, W))
    du = np.minimum((u * 8) % 1.0, 1 - (u * 8) % 1.0)[None, :]           # distance à l'arête de l'octogone
    dv = np.minimum(v, 1 - v)[:, None]
    edge = np.clip(np.exp(-du / 0.06) + np.exp(-dv / 0.03), 0, 1)           # arêtes polies, métal nu
    brushed = fbm((H, W), (4, 150), rng, octs=3, tile=True)                 # polissage directionnel
    lum = (0.26 + 0.05 * (hammer - 0.5) + 0.04 * (brushed - 0.5) + 0.05 * scr - 0.08 * np.clip(wear - 0.6, 0, 1)
           + 0.40 * edge + 0.22 * knot + 0.30 * border)
    base = np.stack([lum * 0.93, lum * 0.97, lum * 1.03], -1)
    base = base * (1 - 0.30 * knot[..., None]) + 0.30 * knot[..., None] * np.array([0.60, 0.33, 0.17])[None, None, :]
    rough = 0.26 + 0.06 * (brushed - 0.5) + 0.18 * scr + 0.12 * np.clip(wear - 0.6, 0, 1) - 0.14 * edge - 0.10 * knot
    metal = np.ones((H, W), np.float32) * 0.97
    height = 0.10 * hammer + 0.03 * fine + 0.9 * knot + 0.8 * border - 0.15 * scr
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.10, 1), metal), normal=normal_map(height, 4.5))


def glove_textures(seed, W=256, H=512, stitch=(0.55, 0.07, 0.08), leather=0.075, tint=(1.02, 0.98, 0.96)):
    """Cuir charbon grainé, couture crantée (fil cramoisi) sur la ligne u=0."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    pores = fbm((H, W), (110, 110), rng, octs=3, tile=True)
    crease = fbm((H, W), (10, 6), rng, octs=4, tile=True)
    scuff = fbm((H, W), (5, 4), rng, octs=5, tile=True)
    du = np.minimum(u, 1 - u)[None, :]
    dash = (((v * 14) % 1.0) < 0.62)[:, None].astype(np.float32)
    thread = (np.exp(-(du / 0.012) ** 4)) * dash
    seam = np.exp(-(du / 0.03) ** 2) * 0.6
    lum = leather + 0.025 * (pores - 0.5) + 0.02 * (crease - 0.5) + 0.04 * np.clip(scuff - 0.6, 0, 1)
    base = np.stack([lum * tint[0], lum * tint[1], lum * tint[2]], -1)
    base = base * (1 - thread[..., None]) + thread[..., None] * np.array(stitch)[None, None, :]
    rough = 0.55 + 0.15 * (pores - 0.5) + 0.20 * np.clip(scuff - 0.6, 0, 1) - 0.1 * thread
    height = 0.12 * pores + 0.10 * crease - 0.35 * seam + 0.3 * thread
    return dict(base=to_img(base), mr=mr_map(np.clip(rough, 0.2, 1), np.zeros((H, W), np.float32)),
                normal=normal_map(height, 4.5))


def dragon_scale_textures(seed, cells=12, S=512, base=(0.36, 0.035, 0.04)):
    """Écailles de dragon qui se chevauchent (métal cramoisi / acier sombre), tuilables. cells doit être pair."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:S, 0:S]
    fx = (xx + 0.5) / S * cells
    fy = (yy + 0.5) / S * cells
    h = np.zeros((S, S), np.float32)
    d_best = np.full((S, S), 2.0, np.float32)
    dxb = np.zeros((S, S), np.float32)
    rnd = np.zeros((S, S), np.float32)
    best = np.full((S, S), -99, int)
    salt = rng.random(2) * 100
    for dj in (-1, 0, 1, 2):
        j = np.floor(fy).astype(int) + dj
        off = 0.5 * (j % 2)
        cxi = np.round(fx - off) + off
        dx, dy = fx - cxi, fy - j
        d = (dx / 0.62) ** 2 + (dy / 0.80) ** 2
        take = (d < 1) & (j >= best)
        r = np.abs(np.sin((np.floor(cxi * 2) % (cells * 2)) * 12.9898 + (j % cells) * 78.233 + salt[0])) * 43758.5453 % 1.0
        d_best = np.where(take, d, d_best)
        dxb = np.where(take, dx, dxb)
        rnd = np.where(take, r, rnd)
        best = np.where(take, j, best)
    d = np.clip(d_best, 0, 1)
    dome = (1 - d) ** 0.5
    rim = sstep(0.74, 1.0, d)
    hi = sstep(0.50, 0.72, d) * (1 - rim)
    ridge = np.exp(-(dxb / 0.07) ** 2) * (1 - d)
    tone = 0.62 + 0.55 * dome + 0.25 * hi + 0.15 * ridge
    dark = (rnd < 0.22).astype(np.float32)
    col = np.array(base)[None, None, :] * (0.75 + 0.5 * rnd[..., None]) * tone[..., None]
    col = col * (1 - dark[..., None]) + dark[..., None] * np.array([0.09, 0.08, 0.10])[None, None, :] * tone[..., None]
    col = col * (1 - 0.65 * rim[..., None])
    fine = fbm((S, S), (60, 60), rng, octs=2)
    rough = 0.28 + 0.30 * rim + 0.08 * (fine - 0.5) + 0.12 * dark
    metal = np.full((S, S), 0.88, np.float32) - 0.25 * rim
    height = 0.9 * dome + 0.25 * ridge - 0.9 * rim + 0.05 * fine
    return dict(base=to_img(col), mr=mr_map(np.clip(rough, 0.12, 1), metal), normal=normal_map(height, 7.0))
