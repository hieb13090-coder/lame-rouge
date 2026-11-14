"""Épée de feu « Brasier » v2 (flamberge, rendu réaliste AAA) -> GLB.

Lame ondulée (flamberge) à gouttière centrale où court la lave, acier noirci forgé, fissures incandescentes, gravure BRASIER
lumineuse. Garde : bloc central, deux cornes en langue de flamme par côté, bagues et ornements de cuivre, inclusions de braise.
Poignée de cuir noir cordée, pommeau en flamme cannelée. Repère : lame vers +Y, origine = centre de la poignée. ~1,25 m.
Usage : python3 gen_flamberge.py <dossier>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_longsword as G  # noqa: E402
import kit  # noqa: E402
from kit import H, pbr, sweep  # noqa: E402
import forge_tex as FT  # noqa: E402
import sword_textures as TX  # noqa: E402
from sword_textures import fbm  # noqa: E402

sst = H.smoothstep
L = 0.95
G.L = L
WL, WA = 0.19, 0.0125                  # longueur d'onde et amplitude de l'ondulation
G.YR = 0.036


def env(y):
    return sst(0.045, 0.16, y) * (1.0 - sst(0.80 * L, 0.97 * L, y))


def ox(y):                              # déport latéral de l'axe de la lame
    return WA * env(y) * np.sin(2 * np.pi * (y - 0.045) / WL)


def a_of(y):                            # demi-largeur : légère pulsation en phase avec l'onde (flamme)
    y1 = 0.70 * L
    base = 0.0275 + (0.0225 - 0.0275) * np.clip(y / y1, 0, 1) + 0.0030 * env(y) * np.cos(2 * np.pi * (y - 0.045) / WL)
    s = np.clip((y - y1) / (L - y1), 0, 1)
    return base * np.clip(1 - s ** 1.6, 0, 1) ** 0.72


def b_of(y):
    b = 0.0046 + (0.0022 - 0.0046) * np.clip(y / L, 0, 1) + 0.0008 * (1 - sst(G.YR - 0.006, G.YR + 0.006, y))
    s = np.clip((y - 0.70 * L) / (0.30 * L), 0, 1)
    return b * np.clip(1 - s ** 3, 0, 1) ** 0.5


G.a_of, G.b_of = a_of, b_of


def blade_parts():
    ys = np.concatenate([np.linspace(0, 0.96 * L, 190), np.linspace(0.96 * L, L, 20)[1:]])
    t = G.t_cols()
    C = len(t)
    rings = np.zeros((len(ys), C, 3))
    for k, y in enumerate(ys):
        a = a_of(y)
        x = a * np.sin(np.pi / 2 * t)
        z = G.top_z(x, y)
        z = np.where(np.arange(C) < G.N, z, -z)
        rings[k] = np.stack([x + ox(y), np.full(C, y), z], -1)
    U = np.repeat((np.arange(C + 1) / C)[None, :], len(ys), axis=0)
    P, UV, F = H.grid_surface(rings, U, ys / L)
    return [(P, UV, F), H.cap(rings[0], (0, -1, 0))]


def blade_texture(seed, W=512, Ht=4096):
    rng = np.random.default_rng(seed)
    N = G.N
    C = 2 * N
    u = (np.arange(W) + 0.5) / W
    v = 1 - (np.arange(Ht) + 0.5) / Ht
    y = v * L
    idx = u * C
    t = np.where(idx < N, 1 - 2 * np.clip(idx, 0, N - 1) / (N - 1), -1 + 2 * np.clip(idx - N, 0, N - 1) / (N - 1))
    a = a_of(y)[:, None]
    ax = np.abs(a * np.sin(np.pi / 2 * t)[None, :])
    e = G.e_of(y)[:, None]
    fw, fd = G.fuller_of(y)
    fw = fw[:, None]
    bevel = np.where(e > 1e-4, sst(-0.0003, 0.0002, ax - (a - e)), 0.0)
    fuller = np.where(fw > 1e-4, np.clip(1 - ax / np.maximum(fw, 1e-6), 0, 1) ** 0.6, 0.0)
    ric = (1 - sst(G.YR - 0.004, G.YR + 0.010, y))[:, None] * np.ones((1, W))
    edge = sst(-0.0007, 0.0, ax - a)

    brush = fbm((Ht, W), (900, 6), rng, octs=3, tile=False)
    grind = fbm((Ht, W), (260, 26), rng, octs=3, tile=False)
    mott = fbm((Ht, W), (40, 4), rng, octs=5, tile=False)
    scale = fbm((Ht, W), (60, 10), rng, octs=5, tile=False)
    crk = fbm((Ht, W), (70, 7), rng, octs=5, tile=False)
    crk2 = fbm((Ht, W), (180, 14), rng, octs=4, tile=False)
    pt = FT.pits((Ht, W), rng, 1100) * (0.4 + 0.6 * np.maximum(ric, fuller * 0.6))
    scr = np.asarray(TX.scratches((Ht, W), rng, 200, along_rows=True, length=(40, 600), spread=0.08, cross=60), np.float32)
    scr = scr / max(scr.max(), 1e-6)

    # fissures de lave : lignes là où le bruit croise 0,5 ; denses près des tranchants et dans la gouttière, rares ailleurs
    line = 1 - sst(0.0, 0.045, np.abs(crk - 0.5)) + 0.7 * (1 - sst(0.0, 0.030, np.abs(crk2 - 0.5)))
    chan = np.clip(fuller * 1.6 - 0.55, 0, 1) * (0.55 + 0.45 * fbm((Ht, W), (30, 3), rng, octs=3, tile=False))   # chenal de lave central
    zone = np.clip(0.30 + 0.9 * sst(0.35, 1.0, ax / np.maximum(a, 1e-4)) * (1 - ric) + 1.3 * fuller + 0.5 * ric, 0, 1)
    heat = sst(0.15, 0.95, v)[:, None]                              # plus chaud vers la pointe
    lava = np.clip(line * zone * (0.55 + 0.75 * heat) + chan * (0.8 + 0.4 * heat), 0, 1.4)
    lava = lava * (1 - bevel * 0.5)
    text = TX.draw_text("BRASIER", 0.075, 0.021, 2 * np.pi * 0.0262, L, W, Ht, ucs=(0.25, 0.75), scale=0.34)

    lum = 0.15 + 0.04 * (brush - 0.5) + 0.03 * (mott - 0.5) + 0.04 * scr
    lum = lum * (1 - bevel) + bevel * (0.30 + 0.03 * (grind - 0.5))
    lum = lum * (1 - ric) + ric * (0.08 + 0.05 * scale)
    lum = lum - 0.07 * pt
    lum = lum * (1 - 0.8 * np.clip(lava, 0, 1))
    base = np.stack([lum * 1.03, lum, lum * 0.95], -1)
    r = 0.34 + 0.06 * (brush - 0.5) + 0.05 * (mott - 0.5) - 0.05 * scr + 0.30 * ric + 0.30 * pt
    r = r * (1 - bevel) + bevel * 0.18
    r = r * (1 - 0.6 * np.clip(lava, 0, 1)) + 0.0
    h = 0.06 * brush + 0.03 * grind - 0.6 * pt - 0.9 * np.clip(lava, 0, 1) * 0.6 - 0.9 * text + 0.15 * ric * scale
    em = np.clip(lava, 0, 1.2)[..., None] * np.array([1.0, 0.30 + 0.25 * 0, 0.05]) + text[..., None] * np.array([1.0, 0.72, 0.30]) * 1.1
    em = em * (0.55 + 0.45 * np.clip(crk2 * 1.4, 0, 1))[..., None] * (1 - 0.0)
    em = np.clip(em, 0, 1)
    return dict(base=TX.to_img(base), mr=TX.mr_map(np.clip(r, 0.08, 0.95), np.full((Ht, W), 1.0, np.float32)),
                normal=TX.normal_map(h, 2.5), emissive=TX.to_img(em))


# ------------------------------------------------------------------ garde : cornes de flamme
def horn(sx, ctrl, w0, w1, th0, th1, n=70, z=0.0, curve=None):
    p = np.asarray(H.catmull([(sx * x, y, z) for x, y in ctrl], n))
    s = np.linspace(0, 1, n)
    wd = (w0 + (w1 - w0) * s) * np.clip(1 - sst(0.80, 1.0, s) ** 1.0, 0, 1) ** 0.6
    th = (th0 + (th1 - th0) * s) * np.clip(1 - sst(0.85, 1.0, s), 0, 1) ** 0.5
    return sweep(p, th, wd, C=24, vscale=0.05, power=2.6, up=(0, 0, 1), caps=(True, False))


def guard_parts():
    steel, cop, ember = [], [], []
    n = 24
    y = np.linspace(-0.018, 0.018, n)
    s = (y + 0.018) / 0.036
    rx = 0.029 + 0.004 * sst(0.4, 1.0, s)
    rz = 0.0135 + 0.0010 * np.sin(np.pi * s)
    steel += sweep(np.stack([np.zeros(n), y, np.zeros(n)], -1), rx, rz, C=48, vscale=0.05, power=3.4, up=(1, 0, 0), caps=(True, True))
    for sz in (1, -1):                                    # inclusions de braise : losanges sur chaque face
        m = 26
        yy = np.linspace(-0.0150, 0.0150, m)
        s_ = (yy + 0.0150) / 0.030
        w = 0.0105 * np.where(s_ < 0.5, s_ / 0.5, (1 - s_) / 0.5) ** 0.9
        ember += sweep(np.stack([np.zeros(m), yy, np.full(m, sz * 0.0142)], -1), w, 0.0010 + 0.0013 * w / 0.0105, C=4, vscale=0.05, up=(1, 0, 0), caps=(True, True))
    for sx in (1, -1):
        steel += horn(sx, [(0.024, 0.0), (0.062, -0.006), (0.100, 0.002), (0.128, 0.026), (0.134, 0.066), (0.124, 0.100)], 0.0120, 0.0060, 0.0072, 0.0030)
        steel += horn(sx, [(0.024, -0.004), (0.052, -0.020), (0.078, -0.044), (0.084, -0.072)], 0.0085, 0.0035, 0.0052, 0.0020, n=50)
        steel += horn(sx, [(0.026, 0.006), (0.050, 0.020), (0.064, 0.044)], 0.0065, 0.0025, 0.0040, 0.0016, n=40, z=0.0)
        for xr in (0.034, 0.044):                          # bagues de cuivre sur la corne principale
            q = np.linspace((xr * sx, -0.0020, 0), ((xr + 0.004) * sx, -0.0022, 0), 6)
            rr = 0.0112 * np.sin(np.pi * np.linspace(0, 1, 6)) ** 0.3
            cop += sweep(q, rr * 1.05, rr * 0.96, C=28, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, True))
    return steel, cop, ember


def pommel_parts():
    """Flamme cannelée : bulbe à cannelures torsadées, pointe de flamme."""
    yc = G.GRIP_BOT
    prof = [(0.0, 0.0105), (-0.003, 0.0098), (-0.010, 0.0150), (-0.022, 0.0215), (-0.034, 0.0230), (-0.046, 0.0185), (-0.060, 0.0115), (-0.074, 0.0060), (-0.086, 0.0025), (-0.092, 0.0)]
    pr = H.catmull([(yc + a, r) for a, r in prof], 70)
    pr[:, 1] = np.clip(pr[:, 1], 0, None)
    y0 = yc

    def flutes(u, k, y):
        r = pr[k][1]
        return 0.0021 * np.cos(2 * np.pi * (6 * u + 9.0 * (y0 - y) / 0.09)) * sst(0.004, 0.012, r) * sst(0.0, 0.010, 0.020 - abs(y0 - y - 0.040) * 0.5)
    steel = H.lathe(pr, 72, scale_v=0.10, mod=flutes)
    cop = []
    for yy in (yc - 0.0035, yc - 0.0165):                  # bagues de cuivre
        cop += H.lathe([(yy + 0.003, 0.0125), (yy + 0.002, 0.0140), (yy - 0.002, 0.0140), (yy - 0.003, 0.0125)], 40, scale_v=0.02)
    return steel, cop


def build(out):
    seed = 91
    bt = blade_texture(seed)
    g_steel, g_cop, g_ember = guard_parts()
    leather, wire = G.grip_parts()
    p_steel, p_cop = pommel_parts()
    ember_tex = dict(base=Image.new("RGB", (8, 8), (40, 12, 4)), mr=Image.new("RGB", (8, 8), (0, 90, 0)),
                     normal=Image.new("RGB", (8, 8), (128, 128, 255)), emissive=Image.new("RGB", (8, 8), (255, 90, 14)))
    cop_tex = FT.aged_gold(seed + 2, tint=(0.62, 0.30, 0.13), rough=0.38)
    sets = {"Blade": (blade_parts(), 26, pbr("brasier_blade", bt, emissiveTexture=bt["emissive"], emissiveFactor=[1, 1, 1])),
            "Fittings": (g_steel + p_steel, 40, pbr("brasier_dark_steel", FT.dark_steel(seed + 1, lum=0.17, rough=0.46))),
            "Copper": (g_cop + p_cop + wire, 40, pbr("brasier_copper", cop_tex)),
            "Ember": (g_ember, 40, pbr("brasier_ember", ember_tex, emissiveTexture=ember_tex["emissive"], emissiveFactor=[1, 1, 1])),
            "Grip": (leather, 60, pbr("brasier_leather", FT.grip_leather(seed + 3, color=(0.060, 0.030, 0.026), stitch=(0.28, 0.10, 0.04))))}
    kit.assemble(Path(out) / "sword_fire_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
