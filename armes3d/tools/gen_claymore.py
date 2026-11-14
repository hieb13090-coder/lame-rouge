"""Claymore « Tempête » (épée à deux mains écossaise) -> GLB. Lame large à longue gouttière gravée TEMPETE, quillons inclinés
vers la lame terminés en quatrefeuilles, poignée de cuir sur fil de laiton, pommeau en disque à bossage. ~1,50 m.
Réutilise les briques de gen_longsword (section de lame, texture, poignée). Repère : lame vers +Y, origine = centre de la poignée.
Usage : python3 gen_claymore.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_longsword as G  # noqa: E402
import kit  # noqa: E402
from kit import H, pbr, sweep  # noqa: E402
import forge_tex as FT  # noqa: E402
import sword_textures as TX  # noqa: E402

sst = H.smoothstep
L = 1.06
G.L, G.YR = L, 0.045
G.GRIP_TOP, G.GRIP_BOT = -0.018, -0.290
H.SHIFT_Y = -(G.GRIP_TOP + G.GRIP_BOT) / 2


def a_of(y):
    y1 = 0.74 * L
    base = 0.0340 + (0.0262 - 0.0340) * np.clip(y / y1, 0, 1)
    s = np.clip((y - y1) / (L - y1), 0, 1)
    return base * np.clip(1 - s ** 1.8, 0, 1) ** 0.70


def b_of(y):
    b = 0.0050 + (0.0024 - 0.0050) * np.clip(y / L, 0, 1) + 0.0010 * (1 - sst(G.YR - 0.006, G.YR + 0.006, y))
    s = np.clip((y - 0.72 * L) / (0.28 * L), 0, 1)
    return b * np.clip(1 - s ** 3, 0, 1) ** 0.5


def fuller_of(y):
    m = sst(G.YR + 0.004, G.YR + 0.050, y) * (1 - sst(0.66 * L, 0.74 * L, y))
    return 0.0105 * m ** 0.6, 0.0020 * m ** 0.5


G.a_of, G.b_of, G.fuller_of = a_of, b_of, fuller_of
_draw = TX.draw_text
TX.draw_text = lambda txt, *a, **k: _draw("TEMPETE", *a, **k)


def quatrefoil(c, d, n_in, r_lobe=0.0112, off=0.0138):
    """4 lobes + coeur à l'extrémité d'un quillon : disque plat perpendiculaire à la direction d."""
    d = d / np.linalg.norm(d)
    u = np.cross(d, (0, 0, 1.0))
    u /= np.linalg.norm(u)
    w = np.cross(d, u)
    parts = []
    for o in (u, -u, w, -w):
        q = c[None] + off * o[None] + np.linspace(-0.0035, 0.0035, 12)[:, None] * d[None]
        rr = r_lobe * np.sin(np.pi * np.linspace(0, 1, 12)) ** 0.55
        parts += sweep(q, rr, rr, C=18, vscale=0.05, up=(0, 0, 1), caps=(True, True))
    q = c[None] + np.linspace(-0.0045, 0.0045, 12)[:, None] * d[None]
    rr = 0.0145 * np.sin(np.pi * np.linspace(0, 1, 12)) ** 0.55
    parts += sweep(q, rr, rr, C=22, vscale=0.05, up=(0, 0, 1), caps=(True, True))
    return parts


def guard_parts():
    steel, gold = [], []
    n = 26
    y = np.linspace(-0.018, 0.018, n)
    s = (y + 0.018) / 0.036
    rx = 0.028 + 0.005 * sst(0.4, 1.0, s)
    rz = 0.0140 + 0.0010 * np.sin(np.pi * s)
    steel += sweep(np.stack([np.zeros(n), y, np.zeros(n)], -1), rx, rz, C=48, vscale=0.05, power=3.6, up=(1, 0, 0), caps=(True, True))
    for sz in (1, -1):                                       # écussons dorés
        m = 26
        yy = np.linspace(-0.0160, 0.0160, m)
        s_ = (yy + 0.0160) / 0.032
        w = 0.0120 * np.where(s_ < 0.5, s_ / 0.5, (1 - s_) / 0.5) ** 0.9
        gold += sweep(np.stack([np.zeros(m), yy, np.full(m, sz * 0.0148)], -1), w, 0.0010 + 0.0016 * w / 0.012, C=4, vscale=0.05, up=(1, 0, 0), caps=(True, True))
    for sx in (1, -1):                                       # quillons inclinés vers la lame
        n = 70
        ctrl = [(0.024 * sx, 0.0, 0), (0.070 * sx, 0.004, 0), (0.118 * sx, 0.018, 0), (0.158 * sx, 0.040, 0), (0.182 * sx, 0.066, 0)]
        p = np.asarray(H.catmull(ctrl, n))
        s = np.linspace(0, 1, n)
        r = 0.0125 - 0.0050 * s + 0.0020 * np.exp(-((s - 0.10) / 0.03) ** 2) + 0.0014 * np.exp(-((s - 0.55) / 0.025) ** 2)
        steel += sweep(p, r * 1.05, r * 0.92, C=28, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, True))
        gold += quatrefoil(p[-1], p[-1] - p[-4], 0)
        for xr in (0.034, 0.040):                            # bagues
            q = np.linspace((xr * sx, 0.0003, 0), ((xr + 0.003) * sx, 0.0006, 0), 6)
            rr = 0.0118 * np.sin(np.pi * np.linspace(0, 1, 6)) ** 0.3
            gold += sweep(q, rr * 1.05, rr * 0.96, C=28, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, True))
    return steel, gold


def pommel_parts():
    """Disque à bord perlé, bossage central, col."""
    yc = G.GRIP_BOT - 0.026
    prof = [(0.0195, 0.0), (0.0195, 0.0060), (0.0170, 0.0100), (0.0125, 0.0110), (0.0090, 0.0130), (0.0, 0.0136)]
    prof = prof + [(-h, r) for h, r in prof[::-1][1:]]
    pr = np.asarray(H.catmull(prof, 60))
    pr[:, 1] = np.clip(pr[:, 1], 0, None)
    K = 1.55
    c0 = np.array([0.0, yc, 0.0])
    big = lambda Q: (Q - c0) * K + c0
    steel = []
    for P, UV, F in H.lathe(pr, 56, scale_v=0.08):
        steel.append((big(np.stack([P[:, 0], P[:, 2] + yc, P[:, 1]], -1)), UV, F[:, ::-1]))
    gold = []
    for sz in (1, -1):
        bp = [(0.0140, 0.0), (0.0138, 0.0025), (0.0126, 0.0042), (0.0104, 0.0052), (0.0080, 0.0055)]
        for P, UV, F in H.lathe(H.catmull(bp, 20), 48, scale_v=0.05, close_start=False, close_end=True):
            gold.append((big(np.stack([P[:, 0], P[:, 2] + yc, sz * (P[:, 1] + 0.0136 - 0.0)], -1)), UV, F[:, ::-1] if sz > 0 else F))
    neck = H.lathe(H.catmull([(G.GRIP_BOT - 0.001, 0.0112), (G.GRIP_BOT - 0.003, 0.0100), (yc + 0.020 * K, 0.0090), (yc + 0.0145 * K, 0.0100)], 16), 40, scale_v=0.05)
    yb = yc - 0.0136 * K + 0.0015
    peen = H.lathe(H.catmull([(yb + 0.002, 0.0090), (yb - 0.004, 0.0088), (yb - 0.010, 0.0060), (yb - 0.014, 0.0)], 16), 40, scale_v=0.05)
    return steel + neck + peen, gold


def build(out):
    seed = 121
    bt = G.blade_texture(seed)
    g_steel, g_gold = guard_parts()
    leather, wire = G.grip_parts()
    p_steel, p_gold = pommel_parts()
    sets = {"Blade": (G.blade_parts(), 26, pbr("claymore_blade", bt)),
            "Fittings": (g_steel + p_steel, 40, pbr("claymore_dark_steel", FT.dark_steel(seed + 1, lum=0.30))),
            "Gold": (g_gold + wire + p_gold, 40, pbr("claymore_gold", FT.aged_gold(seed + 2, tint=(0.70, 0.60, 0.40), rough=0.34))),
            "Grip": (leather, 60, pbr("claymore_leather", FT.grip_leather(seed + 3, color=(0.14, 0.075, 0.045))))}
    kit.assemble(Path(out) / "claymore_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
