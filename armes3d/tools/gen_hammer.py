"""Marteau de guerre « Brise-Monts » (sans élément) -> GLB. Tête octogonale en fer martelé avec bande gravée de tressage,
bagues de cuivre, manche d'orme, enroulement de cuir brun, anneau de cuir au culot. ~0,63 m.
Repère : tête le long de X, manche le long de Y, origine = centre de la prise. Usage : python3 gen_hammer.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, circle_path  # noqa: E402
import naginata_textures as NT  # noqa: E402
import sword_textures as TX  # noqa: E402

HEAD_CY, HEAD_L = 0.405, 0.27
WRAP_TOP, WRAP_BOT, PITCH = 0.33, 0.02, 0.020
H.SHIFT_Y = -0.17


def head_r(s):
    s = np.asarray(s, float)
    e = np.abs(2 * s - 1)
    r = 0.060 + 0.012 * e ** 1.8
    c = np.clip((e - 0.93) / 0.07, 0, 1)
    return r - 0.020 * c ** 1.5


def head_sweep(s0, s1, n, extra=0.0, vscale=HEAD_L, caps=(False, False)):
    s = np.linspace(s0, s1, n)
    x = -HEAD_L / 2 + HEAD_L * s
    path = np.stack([x, np.full(n, HEAD_CY), np.zeros(n)], -1)
    r = head_r(s) + extra
    return sweep(path, r, r, C=8, vscale=vscale, power=2.0, up=(0, 1, 0), rot=np.pi / 8, caps=caps)


def head_parts():
    return head_sweep(0.0, 1.0, 60, caps=(True, True))


def band_parts():
    out = []
    for c, w in ((0.115, 0.050), (0.885, 0.050), (0.298, 0.016), (0.702, 0.016)):
        out += head_sweep(c - w / 2, c + w / 2, 6, extra=0.0032, vscale=0.05, caps=(True, True))
    return out


def wrap_parts():
    ys = np.linspace(WRAP_TOP, WRAP_BOT, 80)
    prof = np.stack([ys, np.full(80, 0.0158)], -1)
    ridge = lambda u, k, y: 0.0013 * (0.5 + 0.5 * np.cos(2 * np.pi * (u + (WRAP_TOP - y) / PITCH))) ** 2 \
        + 0.0007 * np.sin(np.pi * (WRAP_TOP - y) / (WRAP_TOP - WRAP_BOT)) ** 0.5
    return H.lathe(prof, 32, scale_v=WRAP_TOP - WRAP_BOT, mod=ridge)


def haft_parts():
    ctrl = [(0.505, 0.0125), (0.490, 0.0150), (0.30, 0.0150), (0.0, 0.0150), (-0.020, 0.0165), (-0.040, 0.0215),
            (-0.056, 0.0235), (-0.070, 0.0170), (-0.078, 0.0)]
    prof = H.catmull(ctrl, 70)
    prof[:, 1] = np.clip(prof[:, 1], 0, None)
    return H.lathe(prof, 32, scale_v=0.6)


def cap_parts():
    return H.lathe([(0.466, 0.0152), (0.474, 0.0172), (0.500, 0.0176), (0.507, 0.0140)], 32, scale_v=0.05) + \
        H.lathe([(WRAP_TOP + 0.004, 0.0160), (WRAP_TOP + 0.001, 0.0178), (WRAP_TOP - 0.006, 0.0178), (WRAP_TOP - 0.009, 0.0163)], 32, scale_v=0.05) + \
        H.lathe([(WRAP_BOT + 0.009, 0.0163), (WRAP_BOT + 0.006, 0.0178), (WRAP_BOT - 0.001, 0.0178), (WRAP_BOT - 0.004, 0.0160)], 32, scale_v=0.05)


def loop_parts():
    return sweep(circle_path((0, -0.098, 0), 0.022, 44), 0.0038, 0.0038, C=14, vscale=0.05, up=(0, 0, 1), caps=(True, True))


def langet_parts():
    """Attelles d'acier (langets) rivetées sur le manche, sous la tête."""
    out = []
    for sx in (1, -1):
        n = 30
        y = np.linspace(HEAD_CY - 0.05, 0.225, n)
        s = np.linspace(0, 1, n)
        w = 0.0065 * np.clip(1 - s ** 4, 0, 1) ** 0.6 + 0.0004
        th = 0.0017 * np.ones(n)
        out += sweep(np.stack([np.full(n, sx * 0.0155), y, np.zeros(n)], -1), th, w, C=16, vscale=0.15, power=3.0, up=(1, 0, 0), caps=(True, True))
        for yr in (0.325, 0.285, 0.248):
            m = 8
            xx = sx * np.linspace(0.0168, 0.0188, m)
            r = 0.0032 * np.sqrt(np.clip(1 - np.linspace(0, 1, m) ** 2, 0, 1))
            out += sweep(np.stack([xx, np.full(m, yr), np.zeros(m)], -1), r, r, C=14, vscale=0.02, up=(0, 1, 0), caps=(True, False))
    return out


def build(out):
    seed = 81
    head = NT.hammer_head_textures(seed)
    import forge_tex as FT
    copper = FT.aged_gold(seed + 1, tint=(0.80, 0.46, 0.30), rough=0.34)
    steel = FT.dark_steel(seed + 5, lum=0.34, rough=0.38)
    wood = NT.wood_textures(seed + 2, tint=(0.16, 0.09, 0.05))
    wrap = TX.leather_textures(seed + 3, WRAP_TOP - WRAP_BOT, PITCH, tint=(0.30, 0.16, 0.08))
    loop = TX.leather_textures(seed + 4, 0.1, 0.02, tint=(0.26, 0.14, 0.07))
    sets = {"Head": (head_parts(), 40, pbr("hammered_iron", head)),
            "Copper": (band_parts() + cap_parts(), 40, pbr("copper", copper)),
            "Haft": (haft_parts(), 50, pbr("elm_wood", wood)),
            "Wrap": (wrap_parts(), 55, pbr("leather_wrap", wrap)),
            "Loop": (loop_parts(), 60, pbr("leather_loop", loop)),
            "Langets": (langet_parts(), 40, pbr("langet_steel", steel))}
    return kit.assemble(Path(out) / "hammer_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
