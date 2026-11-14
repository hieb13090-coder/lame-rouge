"""Dague « Vipère » v2 -> GLB. Lame ondulée à deux tranchants (acier damassé), ganja d'acier festonnée,
mendak de laiton perlé, manche d'ébène sculpté en écailles de serpent, bagues de laiton, selut en calice. ~0,36 m.
Repère : lame vers +Y, manche courbé vers +X, origine = milieu du manche. Usage : python3 gen_dagger.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, line  # noqa: E402
import naginata_textures as NT  # noqa: E402

L = 0.26
H.SHIFT_Y = 0.045
cx = lambda t: 0.0078 * kit.sstep(0.0, 0.15, np.asarray(t, float)) * (1 - 0.55 * np.asarray(t, float)) * np.sin(2 * np.pi * 2.5 * np.asarray(t, float))
_wl = kit.leaf_width(0.026, 0.022, 0.78)
WF = lambda t: _wl(t) + 0.016 * (1 - kit.sstep(0.0, 0.16, np.asarray(t, float)))
TF = lambda t: 0.0030 * (np.clip(WF(t), 0, None) / 0.030) ** 0.8

# trajectoire du manche (courbe douce vers +X), échantillonnée une fois pour tout le monde
NP = 120
CTRL = [(0, -0.030, 0), (0.0015, -0.050, 0), (0.008, -0.074, 0), (0.021, -0.096, 0), (0.036, -0.108, 0)]
HPATH = H.catmull(CTRL, NP)
S = np.linspace(0, 1, NP)


def ganja_parts():
    """Plaque d'acier festonnée sous la lame (sekar kacang simplifié), 7 lobes, bord chanfreiné."""
    prof = [(0.0050, 0.011), (0.0046, 0.022), (0.0030, 0.0275), (0.0000, 0.0300), (-0.0030, 0.0275), (-0.0046, 0.022), (-0.0050, 0.012)]
    prof = H.catmull([(y, r) for y, r in prof], 24)
    lobe = lambda u, k, y: 0.0060 * (np.abs(np.sin(np.pi * 7 * u)) ** 0.6 - 0.5) * kit.sstep(0.012, 0.027, prof[k][1])
    parts = H.lathe(prof, 112, scale_v=0.05, mod=lobe)
    return kit.xf(parts, lambda P: P * np.array([1.18, 1.0, 0.66]) + np.array([0.0, 0.0, 0.0]))


def mendak_parts():
    """Cône de laiton perlé sous la ganja : bague, perles, évasement."""
    ys = np.linspace(-0.0035, -0.036, 150)
    base = 0.0112 + 0.0030 * kit.sstep(0.0, 1.0, (-ys - 0.0035) / 0.0325) ** 1.6
    bead = lambda y: 0.0009 * (0.5 + 0.5 * np.cos(2 * np.pi * (y + 0.0035) / 0.0034)) ** 2 * (kit.sstep(-0.0045, -0.0090, y) * (1 - kit.sstep(-0.0300, -0.0330, y)))
    r = base + bead(ys)
    r[0] += 0.0010
    prof = np.stack([ys, r], -1)
    return kit.xf(H.lathe(prof, 64, scale_v=0.05), lambda P: P * np.array([1.0, 1.0, 1.0]))


def hilt_parts():
    """Ébène sculpté : treillis d'écailles en relief le long d'une courbe à section ovale."""
    s = S
    cap = np.where(s < 0.97, 1.0, np.sqrt(np.clip(1 - ((s - 0.97) / 0.03) ** 2, 0, 1)))
    rz = (0.0098 + 0.0016 * s + 0.0020 * np.exp(-((s - 0.0) / 0.05) ** 2)) * cap
    ry = (0.0118 + 0.0040 * s) * cap
    K = NP

    def scales(u, k):
        a = 0.5 + 0.5 * np.cos(2 * np.pi * (7 * u + k / 9.0))
        b = 0.5 + 0.5 * np.cos(2 * np.pi * (7 * u - k / 9.0))
        env = kit.sstep(0.06, 0.14, S[k]) * (1 - kit.sstep(0.84, 0.92, S[k]))
        return 0.0007 * env * (a * b) ** 0.75 - 0.0003 * env
    return sweep(HPATH, rz, ry, C=56, vscale=0.12, up=(0, 0, 1), caps=(True, False), delta=scales)


def bands_parts():
    """Bagues de laiton (fil enroulé) : courts segments de la même courbe, légèrement plus larges."""
    out = []
    for c, w in ((0.045, 0.012), (0.20, 0.012), (0.80, 0.010), (0.86, 0.010)):
        i0, i1 = int((c - w / 2) * NP), int((c + w / 2) * NP)
        seg = HPATH[i0:i1 + 1]
        n = len(seg)
        pr = 0.4 + 0.6 * np.sin(np.pi * np.linspace(0, 1, n)) ** 0.5
        sc = c
        rz = (0.0098 + 0.0016 * sc) + 0.0010 * pr
        ry = (0.0118 + 0.0040 * sc) + 0.0010 * pr
        out += sweep(seg, rz, ry, C=48, vscale=0.04, up=(0, 0, 1), caps=(True, True))
    return out


def selut_parts():
    """Calice de laiton au bout du manche : col, coupe évasée, dôme."""
    i0 = int(0.95 * NP)
    seg = HPATH[i0:]
    d = (seg[-1] - seg[-2]) / np.linalg.norm(seg[-1] - seg[-2])
    n_ext = 14
    ext = seg[-1][None, :] + d[None, :] * np.linspace(0, 0.020, n_ext + 1)[1:, None]
    seg = np.vstack([seg, ext])
    n = len(seg)
    t = np.linspace(0, 1, n)
    flare = 0.0128 + 0.0062 * kit.sstep(0.0, 0.42, t) - 0.0045 * kit.sstep(0.42, 0.85, t)
    dome = np.sqrt(np.clip(1 - ((t - 0.80) / 0.20) ** 2, 0, 1)) * (t > 0.80) + (t <= 0.80)
    rr = flare * dome
    rr[0] = 0.0128
    return sweep(seg, rr * 0.88, rr * 1.04, C=56, vscale=0.05, up=(0, 0, 1), caps=(True, True))


def build(out):
    seed = 61
    steel = NT.double_blade_textures(seed, "pamor", L)
    import forge_tex as FT
    brass = FT.aged_gold(seed + 1, tint=(0.74, 0.56, 0.28), rough=0.34)
    iron = FT.dark_steel(seed + 3, lum=0.40, rough=0.34)
    wood = FT.lacquer(seed + 2, color=(0.075, 0.050, 0.038), rough=0.36, orange=0.30)
    sets = {"Blade": (kit.double_blade(0.0, L, WF, TF, cx=cx, rows=(150, 40), tip_start=0.78), 25, pbr("pamor_steel", steel)),
            "Ganja": (ganja_parts(), 40, pbr("ganja_iron", iron)),
            "Brass": (mendak_parts() + bands_parts() + selut_parts(), 40, pbr("dull_brass", brass)),
            "Hilt": (hilt_parts(), 50, pbr("ebony", wood))}
    return kit.assemble(Path(out) / "dagger_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
