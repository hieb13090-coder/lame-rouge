"""Épée longue « Aurore » v2 (rendu réaliste, niveau jeu AAA) -> GLB.

Lame : section réelle (méplats légèrement bombés, biseaux de tranchant nets, gouttière centrale, talon forgé brut,
pointe effilée en ogive), gravure AURORE (alphabet Sigil) dans la gouttière, non lumineuse.
Garde : bloc central avec écussons en ogive, quillons légèrement recourbés à section carrée arrondie, bagues et boutons.
Poignée : cuir tendu sur âme renflée, bague centrale, bagues en fil d'or torsadé. Pommeau en roue à bouton central.
Repère glTF : Y haut, lame vers +Y, origine = centre de la poignée, mètres. ~1,15 m.
Usage : python3 gen_longsword.py <dossier>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, capsule_profile  # noqa: E402
import forge_tex as FT  # noqa: E402
import sword_textures as TX  # noqa: E402
from sword_textures import fbm  # noqa: E402

L = 0.88                 # longueur de lame
YR = 0.034               # fin du talon (ricasso)
TE = 0.00035             # épaisseur du fil
N = 37                   # points par face
GRIP_TOP, GRIP_BOT = -0.016, -0.214
H.SHIFT_Y = -(GRIP_TOP + GRIP_BOT) / 2
sst = H.smoothstep


# ------------------------------------------------------------------ lame
def a_of(y):
    y1 = 0.70 * L
    base = 0.0265 + (0.0212 - 0.0265) * np.clip(y / y1, 0, 1)
    s = np.clip((y - y1) / (L - y1), 0, 1)
    return base * np.clip(1 - s ** 1.7, 0, 1) ** 0.72


def b_of(y):
    b = 0.0043 + (0.0021 - 0.0043) * np.clip(y / L, 0, 1) + 0.0008 * (1 - sst(YR - 0.006, YR + 0.006, y))
    s = np.clip((y - 0.70 * L) / (0.30 * L), 0, 1)
    return b * np.clip(1 - s ** 3, 0, 1) ** 0.5


def e_of(y):
    return np.minimum(0.0046 * sst(YR - 0.002, YR + 0.012, y), 0.40 * a_of(y))


def fuller_of(y):
    m = sst(YR + 0.002, YR + 0.026, y) * (1 - sst(0.56 * L, 0.63 * L, y))
    return 0.0068 * m ** 0.6, 0.0017 * m ** 0.5


def top_z(x, y):
    a, b, e = a_of(y), b_of(y), e_of(y)
    f, d = fuller_of(y)
    ax = np.abs(x)
    xb = max(a - e, 1e-6)
    flat = b * (1 - 0.35 * (np.minimum(ax, xb) / xb) ** 2)
    bev = np.where(ax <= xb, flat, 0.65 * b + (TE - 0.65 * b) * np.clip((ax - xb) / max(e, 1e-6), 0, 1))
    te_r = 0.0013
    blunt = te_r + (b - te_r) * np.sqrt(np.clip(1 - (ax / max(a, 1e-6)) ** 6, 0, 1))
    m = np.clip(e / 0.0046, 0, 1) if a > 0.012 else 1.0
    z = m * bev + (1 - m) * blunt
    if f > 1e-5:
        z = z - d * 0.5 * (1 + np.cos(np.pi * np.clip(ax / f, 0, 1))) * (ax < f)
    return z


def t_cols():
    t_top = np.linspace(1, -1, N)
    return np.concatenate([t_top, -t_top])          # dessus (x: +a -> -a) puis dessous (x: -a -> +a)


def blade_parts():
    ys = np.concatenate([np.linspace(0, 0.96 * L, 112), np.linspace(0.96 * L, L, 18)[1:]])
    t = t_cols()
    C = len(t)
    rings = np.zeros((len(ys), C, 3))
    for k, y in enumerate(ys):
        a = a_of(y)
        x = a * np.sin(np.pi / 2 * t)
        z = top_z(x, y)
        z = np.where(np.arange(C) < N, z, -z)
        rings[k] = np.stack([x, np.full(C, y), z], -1)
    U = np.repeat((np.arange(C + 1) / C)[None, :], len(ys), axis=0)
    P, UV, F = H.grid_surface(rings, U, ys / L)
    return [(P, UV, F), H.cap(rings[0], (0, -1, 0))]


def blade_texture(seed, W=512, Ht=4096):
    rng = np.random.default_rng(seed)
    C = 2 * N
    u = (np.arange(W) + 0.5) / W
    v = 1 - (np.arange(Ht) + 0.5) / Ht
    y = v * L
    idx = u * C
    t = np.where(idx < N, 1 - 2 * np.clip(idx, 0, N - 1) / (N - 1), -1 + 2 * np.clip(idx - N, 0, N - 1) / (N - 1))
    a = a_of(y)[:, None]
    ax = np.abs(a * np.sin(np.pi / 2 * t)[None, :])
    e = e_of(y)[:, None]
    fw, fd = fuller_of(y)
    fw = fw[:, None]
    bevel = np.where(e > 1e-4, sst(-0.0003, 0.0002, ax - (a - e)), 0.0)
    fuller = np.where(fw > 1e-4, np.clip(1 - ax / np.maximum(fw, 1e-6), 0, 1) ** 0.6, 0.0)
    fshoulder = np.where(fw > 1e-4, np.exp(-((ax - fw) / 0.0008) ** 2), 0.0)
    ric = (1 - sst(YR - 0.004, YR + 0.010, y))[:, None] * np.ones((1, W))
    edge = sst(-0.0007, 0.0, ax - a)

    brush = fbm((Ht, W), (900, 6), rng, octs=3, tile=False)          # brossage dans la longueur
    grind = fbm((Ht, W), (260, 26), rng, octs=3, tile=False)
    mott = fbm((Ht, W), (40, 4), rng, octs=5, tile=False)
    scale = fbm((Ht, W), (60, 10), rng, octs=5, tile=False)
    pt = FT.pits((Ht, W), rng, 900) * (0.35 + 0.65 * np.maximum(ric, fuller * 0.6) + 0.2 * (mott > 0.7))
    scr = np.asarray(TX.scratches((Ht, W), rng, 220, along_rows=True, length=(40, 600), spread=0.08, cross=60), np.float32)
    scr = scr / max(scr.max(), 1e-6)
    nick = np.zeros((Ht, W), np.float32)                              # brèches sur le fil
    for vy in rng.uniform(0.08, 0.90, 26):
        r0 = int((1 - vy) * Ht)
        ln = int(rng.integers(3, 9))
        nick[max(0, r0 - ln):r0 + ln] = np.maximum(nick[max(0, r0 - ln):r0 + ln], 1.0)
    nick = nick * edge * sst(0.0, 0.5, rng.random((Ht, 1)))

    text = TX.draw_text("AURORE", 0.075, 0.021, 2 * np.pi * 0.0262, L, W, Ht, ucs=(0.25, 0.75), scale=0.34)

    lum = 0.53 + 0.05 * (brush - 0.5) + 0.03 * (mott - 0.5) + 0.04 * scr
    lum = lum * (1 - bevel) + bevel * (0.68 + 0.03 * (grind - 0.5))
    lum = lum - 0.10 * fuller - 0.10 * fshoulder
    lum = lum * (1 - ric) + ric * (0.20 + 0.10 * scale)                # talon : calamine de forge
    lum = lum - 0.20 * pt - 0.25 * nick
    lum = lum * (1 - 0.62 * text)
    base = np.stack([lum, lum * 1.005, lum * 1.02], -1)

    r = 0.27 + 0.06 * (brush - 0.5) + 0.05 * (mott - 0.5) - 0.06 * scr
    r = r * (1 - bevel) + bevel * (0.14 + 0.04 * grind)
    r = r + 0.12 * fuller + 0.3 * ric + 0.35 * pt + 0.3 * nick + 0.3 * text
    h = 0.06 * brush + 0.03 * grind - 0.6 * pt - 0.8 * nick - 0.9 * text + 0.15 * ric * scale - 0.15 * scr
    return dict(base=TX.to_img(base), mr=TX.mr_map(np.clip(r, 0.08, 0.95), np.full((Ht, W), 1.0, np.float32)),
                normal=TX.normal_map(h, 2.5))


# ------------------------------------------------------------------ garde
def guard_parts():
    steel, gold = [], []
    # bloc central (section rectangle arrondi), évasé vers la lame
    n = 24
    y = np.linspace(-0.016, 0.016, n)
    s = (y + 0.016) / 0.032
    rx = 0.026 + 0.004 * sst(0.4, 1.0, s)
    rz = 0.0125 + 0.0010 * np.sin(np.pi * s)
    steel += sweep(np.stack([np.zeros(n), y, np.zeros(n)], -1), rx, rz, C=48, vscale=0.05, power=3.6, up=(1, 0, 0), caps=(True, True))
    # écussons en losange sur chaque face du bloc (dorés), arête centrale
    for sz in (1, -1):
        n = 26
        y = np.linspace(-0.0145, 0.0145, n)
        s_ = (y + 0.0145) / 0.029
        w = 0.0115 * np.where(s_ < 0.5, (s_ / 0.5), ((1 - s_) / 0.5)) ** 0.9
        th = 0.0010 + 0.0016 * w / 0.0115
        zc = np.full(n, sz * 0.0131)
        gold += sweep(np.stack([np.zeros(n), y, zc], -1), w, th, C=4, vscale=0.05, power=2.0, up=(1, 0, 0), caps=(True, True))
    # quillons
    for sx in (1, -1):
        n = 60
        ctrl = [(0.022 * sx, 0.0, 0), (0.060 * sx, 0.002, 0), (0.095 * sx, 0.008, 0), (0.122 * sx, 0.019, 0), (0.136 * sx, 0.031, 0)]
        p = H.catmull(ctrl, n)
        s = np.linspace(0, 1, n)
        r = 0.0098 - 0.0035 * s + 0.0018 * np.exp(-((s - 0.10) / 0.03) ** 2) + 0.0014 * np.exp(-((s - 0.62) / 0.025) ** 2)
        r = r * np.clip(1 - sst(0.90, 1.0, s), 0, 1) ** 0.5 + 0.0 * s
        steel += sweep(p, r * 1.05, r * 0.92, C=28, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, False))
        # bouton de quillon (finial) doré
        tip = p[-6]
        d = (p[-1] - p[-8])
        d = d / np.linalg.norm(d)
        m = 16
        q = tip[None] + np.linspace(-0.003, 0.019, m)[:, None] * d[None]
        rr = 0.0088 * np.sin(np.pi * np.linspace(0, 1, m)) ** 0.62 * (1 + 0.15 * np.linspace(-1, 1, m))
        gold += sweep(q, rr, rr, C=24, vscale=0.05, up=(0, 0, 1))
        # bague dorée près du bloc
        q = np.linspace((0.030 * sx, 0.0003, 0), (0.035 * sx, 0.0006, 0), 6)
        rr = 0.0108 * np.sin(np.pi * np.linspace(0, 1, 6)) ** 0.3
        gold += sweep(q, rr * 1.05, rr * 0.96, C=28, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, True))
    return steel, gold


# ------------------------------------------------------------------ poignée + pommeau
def grip_parts():
    n = 90
    y = np.linspace(GRIP_TOP, GRIP_BOT, n)
    s = (y - GRIP_TOP) / (GRIP_BOT - GRIP_TOP)
    r = 0.0128 + 0.0016 * np.sin(np.pi * s) + 0.0011 * (np.exp(-((s - 0.33) / 0.022) ** 2) + np.exp(-((s - 0.66) / 0.022) ** 2)) - 0.0008 * (1 - sst(0.0, 0.06, s))
    leather = sweep(np.stack([np.zeros(n), y, np.zeros(n)], -1), r * 1.10, r * 0.90, C=40, vscale=GRIP_TOP - GRIP_BOT, up=(1, 0, 0),
                    caps=(True, True))
    gold = []
    for y0, y1 in ((GRIP_TOP, GRIP_TOP - 0.013), (GRIP_BOT + 0.013, GRIP_BOT)):      # bagues de fil torsadé (2 brins)
        for ph in (0.0, np.pi):
            m = 110
            tt = np.linspace(0, 1, m)
            ang = ph + tt * 2 * np.pi * 6
            yy = y0 + (y1 - y0) * tt
            rr = 0.0134 + 0.0015
            path = np.stack([rr * 1.10 * np.cos(ang), yy, rr * 0.90 * np.sin(ang)], -1)
            gold += sweep(path, 0.00135, 0.00135, C=6, vscale=0.01, up=(0, 1, 0), caps=(True, True))
    return leather, gold


def pommel_parts():
    yc = GRIP_BOT - 0.031
    prof = [(0.0172, 0.0), (0.0172, 0.0075), (0.0160, 0.0105), (0.0118, 0.0118), (0.0112, 0.0175), (0.0125, 0.0215), (0.0140, 0.0245),
            (0.0140, 0.0285), (0.0110, 0.0318), (0.0055, 0.0334), (0.0, 0.0338)]
    prof = prof + [(-h, r) for h, r in prof[::-1][1:]]
    pr = H.catmull(prof, 64)
    pr[:, 1] = np.clip(pr[:, 1], 0, None)
    steel = []
    parts = H.lathe(pr, 48, scale_v=0.08)
    for P, UV, F in parts:                               # axe de la roue : Y -> Z, centrée sous la poignée
        Q = np.stack([P[:, 0], P[:, 2] + yc, P[:, 1]], -1)
        steel.append((Q, UV, F[:, ::-1]))
    # boutons dorés au centre de chaque face
    gold = []
    for sz in (1, -1):
        bp = [(0.0185, 0.0), (0.0183, 0.0040), (0.0172, 0.0072), (0.0150, 0.0090), (0.0130, 0.0095)]
        for P, UV, F in H.lathe(H.catmull(bp, 20), 48, scale_v=0.05, close_start=False, close_end=True):
            Q = np.stack([P[:, 0], P[:, 2] + yc, sz * P[:, 1]], -1)
            gold.append((Q, UV, F[:, ::-1] if sz > 0 else F))
    # col entre poignée et pommeau + bouton de rivure en bas
    neck = H.lathe(H.catmull([(GRIP_BOT - 0.001, 0.0105), (GRIP_BOT - 0.003, 0.0098), (yc + 0.026, 0.0090), (yc + 0.020, 0.0095)], 16),
                   40, scale_v=0.05)
    peen = H.lathe(H.catmull([(yc - 0.031, 0.0075), (yc - 0.036, 0.0072), (yc - 0.040, 0.0050), (yc - 0.0418, 0.0)], 16), 40, scale_v=0.05)
    return steel + neck + peen, gold


# ------------------------------------------------------------------ assemblage
def build(out):
    seed = 41
    bt = blade_texture(seed)
    g_steel, g_gold = guard_parts()
    leather, wire = grip_parts()
    p_steel, p_gold = pommel_parts()
    sets = {"Blade": (blade_parts(), 26, pbr("aurore_blade", bt)),
            "Fittings": (g_steel + p_steel, 40, pbr("aurore_dark_steel", FT.dark_steel(seed + 1, lum=0.30))),
            "Gold": (g_gold + wire + p_gold, 40, pbr("aurore_gold", FT.aged_gold(seed + 2))),
            "Grip": ([leather[0], *leather[1:]], 60, pbr("aurore_leather", FT.grip_leather(seed + 3, color=(0.19, 0.105, 0.058))))}
    kit.assemble(Path(out) / "sword_epic_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
