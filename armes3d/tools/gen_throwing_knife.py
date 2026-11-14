"""Couteau de lancer « Éclat » v2 -> GLB. Lame en feuille noircie à arête centrale, garde en losange, manche cordé tressé
vert olive, calotte à perles, anneau d'acier martelé ligaturé de cordelette. ~0,27 m.
Repère : pointe vers +Y, origine = milieu du manche. Usage : python3 gen_throwing_knife.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, circle_path  # noqa: E402
import naginata_textures as NT  # noqa: E402
import sword_textures as TX  # noqa: E402

L = 0.125
HAND, PITCH = 0.085, 0.010
H.SHIFT_Y = 0.045
WF = kit.leaf_width(0.024, 0.014, 0.45, bulge=0.006)
TF = lambda t: 0.0030 * (np.clip(WF(t), 0, None) / 0.026) ** 0.8
RING_Y, RING_R, RING_T = -0.1155, 0.0185, 0.0032


def hand_parts():
    """Cordelette tressée : treillis de deux hélices croisées, creux entre les brins."""
    n = 130
    ys = np.linspace(-0.004, -HAND, n)
    s = np.linspace(0, 1, n)
    end = 1.0 - 0.12 * kit.sstep(0.88, 1.0, s)
    prof = np.stack([ys, (0.0064 + 0.0005 * np.sin(np.pi * s)) * end], -1)

    def weave(u, k, y):
        a = 0.5 + 0.5 * np.cos(2 * np.pi * (6 * u + (-0.004 - y) / 0.0165))
        b = 0.5 + 0.5 * np.cos(2 * np.pi * (6 * u - (-0.004 - y) / 0.0165))
        return 0.0010 * np.maximum(a, b) ** 1.5 - 0.0004
    return H.lathe(prof, 48, scale_v=HAND - 0.004, mod=weave)


def steel_parts():
    out = []
    # garde en losange (4 lobes), bord chanfreiné, sous la lame
    gp = H.catmull([(0.0030, 0.007), (0.0027, 0.0120), (0.0015, 0.0150), (0.0, 0.0158), (-0.0015, 0.0150), (-0.0027, 0.0120), (-0.0030, 0.0085)], 14)
    lobes = lambda u, k, y: 0.0030 * (np.abs(np.cos(2 * np.pi * u)) ** 1.6 - 0.5)
    out += kit.xf(H.lathe(gp, 64, scale_v=0.03, mod=lobes), lambda P: P * np.array([1.55, 1.0, 0.62]) + np.array([0.0, 0.0010, 0.0]))
    # collier sous la garde
    out += H.lathe([(-0.0035, 0.0072), (-0.0045, 0.0098), (-0.0075, 0.0098), (-0.0092, 0.0078)], 32, scale_v=0.03)
    # calotte perlée au bas du manche + douille de l'anneau
    prof = [(-0.0800, 0.0066), (-0.0830, 0.0090), (-0.0850, 0.0092), (-0.0875, 0.0078), (-0.0890, 0.0090), (-0.0910, 0.0090), (-0.0930, 0.0074), (-0.0970, 0.0074),
            (-0.1000, 0.0095), (-0.1040, 0.0095), (-0.1070, 0.0070), (-0.1090, 0.0040)]
    out += H.lathe(prof, 40, scale_v=0.03)
    # anneau martelé
    n = 70
    path = circle_path((0, RING_Y - 0.0135, 0), RING_R, n, a0=np.pi / 2 + 0.01, a1=np.pi / 2 + 2 * np.pi - 0.01)
    wob = lambda u, k: 0.00035 * np.sin(2 * np.pi * (u * 3 + k / 5.0))
    out += sweep(path, RING_T, RING_T, C=20, vscale=0.05, up=(0, 0, 1), caps=(True, True), delta=wob)
    return out


def cord_parts():
    """Ligature de cordelette sur l'anneau + deux brins pendants (olive)."""
    out = []
    cy = RING_Y - 0.0135 - RING_R              # bas de l'anneau
    n = 120
    a = np.linspace(0, 2 * np.pi * 3.2, n)
    x = -0.0075 + 0.015 * np.linspace(0, 1, n)
    path = np.stack([x, cy + 0.0052 * np.cos(a), 0.0052 * np.sin(a)], -1)
    out += sweep(path, 0.0013, 0.0013, C=12, vscale=0.03, up=(0, 1, 0), caps=(True, True))
    for sgn, ln, ph in ((1, 0.050, 0.0), (-1, 0.040, 1.9)):
        s = np.linspace(0, 1, 50)
        tail = np.stack([sgn * (0.0075 + 0.004 * s) + 0.003 * np.sin(2 * np.pi * (s * 1.2) + ph) * s,
                         cy - 0.002 - ln * s, 0.0035 * np.cos(2 * np.pi * s * 1.4 + ph) * s], -1)
        out += sweep(tail, 0.0013 * (1 - 0.35 * s), 0.0013 * (1 - 0.35 * s), C=12, vscale=0.03, up=(0, 0, 1), caps=(True, True))
    return out


def build(out):
    seed = 71
    steel = NT.double_blade_textures(seed, "black", L)
    import forge_tex as FT
    iron = FT.dark_steel(seed + 1, lum=0.30, rough=0.40)
    cord = TX.leather_textures(seed + 2, HAND - 0.004, PITCH, tint=(0.15, 0.17, 0.06))
    sets = {"Blade": (kit.double_blade(0.0, L, WF, TF, rows=(80, 34), tip_start=0.45), 25, pbr("blackened_steel", steel)),
            "Steel": (steel_parts(), 45, pbr("dark_iron", iron)),
            "Wrap": (hand_parts() + cord_parts(), 55, pbr("olive_cord", cord))}
    return kit.assemble(Path(out) / "throwing_knife_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
