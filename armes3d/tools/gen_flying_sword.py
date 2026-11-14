"""Épée volante « Plume » -> GLB. Petite lame droite et fine, garde en ailes, gland de soie. ~0,69 m.
Identité : acier miroir, fittings champagne, soie ivoire, filet lumineux discret le long de l'arête (blanc chaud).
Repère : lame vers +Y, origine = centre de la poignée. Usage : python3 gen_flying_sword.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, taper_profile  # noqa: E402
import naginata_textures as NT  # noqa: E402
import sword_textures as TX  # noqa: E402

Y0, L = 0.115, 0.50
GRIP_TOP, GRIP_LEN, PITCH = 0.108, 0.108, 0.014
H.SHIFT_Y = -0.055
WF = kit.leaf_width(0.034, 0.027, 0.80)
TF = lambda t: (0.0030 - 0.0009 * np.asarray(t, float)) * (WF(t) / 0.034) ** 0.8


def feather(sgn, i, n=4):
    """Plume de garde : plaque fine en forme de feuille, éventail de n plumes de chaque côté, superposées en Z."""
    ang = np.radians((6, 22, 38, 54)[i])
    ln = (0.092, 0.078, 0.062, 0.046)[i]
    wd = (0.0135, 0.0125, 0.0115, 0.0100)[i]
    z = 0.0014 * (i - 1.5)
    s = np.linspace(0, 1, 40)
    pts = np.stack([sgn * (0.010 + ln * s * np.cos(ang)),
                    Y0 - 0.004 + ln * s * np.sin(ang) + 0.030 * s ** 2,
                    np.full(40, z)], -1)
    w = wd * np.clip(np.sin(np.pi * np.clip(s ** 0.75, 0, 1)), 0, 1) ** 0.8
    th = 0.0011 * (1 - 0.5 * s) + 0.0002
    return sweep(pts, th, w, C=18, vscale=0.08, up=(0, 0, 1), caps=(True, True))


def guard_parts():
    out = H.lathe([(Y0 - 0.007, 0.010), (Y0 - 0.007, 0.017), (Y0 - 0.002, 0.021), (Y0 + 0.003, 0.017), (Y0 + 0.006, 0.012)], 48, scale_v=0.05)
    for sgn in (-1, 1):
        for i in range(4):
            out += feather(sgn, i)
    return out


def grip_parts():
    n = 120
    ys = np.linspace(GRIP_TOP, 0.0, n)
    prof = np.stack([ys, 0.0108 + 0.0006 * np.sin(np.pi * np.linspace(0, 1, n))], -1)

    def weave(u, k, y):
        a = 0.5 + 0.5 * np.cos(2 * np.pi * (7 * u + (GRIP_TOP - y) / 0.026))
        b = 0.5 + 0.5 * np.cos(2 * np.pi * (7 * u - (GRIP_TOP - y) / 0.026))
        return 0.0009 * np.maximum(a, b) ** 1.4 - 0.0004
    return H.lathe(prof, 56, scale_v=GRIP_LEN, mod=weave)


def collar_parts():
    out = []
    for y in (GRIP_TOP, 0.0):
        out += H.lathe([(y + 0.005, 0.0120), (y + 0.003, 0.0134), (y - 0.003, 0.0134), (y - 0.005, 0.0120)], 30, scale_v=0.03)
    return out


def pommel_parts():
    ctrl = [(0.0, 0.011), (-0.006, 0.016), (-0.016, 0.0175), (-0.026, 0.014), (-0.034, 0.007), (-0.040, 0.0025), (-0.043, 0.0)]
    prof = H.catmull(ctrl, 26)
    prof[:, 1] = np.clip(prof[:, 1], 0, None)
    return H.lathe(prof, 32, scale_v=0.06)


def jade_parts():
    c = -0.0535
    prof = [(c + 0.0085 * np.sin(a), 0.0105 * np.cos(a) * (1 - 0.1 * np.sin(a) ** 2)) for a in np.linspace(np.pi / 2, -np.pi / 2, 28)]
    prof[0] = (prof[0][0], 0.0008)
    prof[-1] = (prof[-1][0], 0.0008)
    return H.lathe(prof, 40, scale_v=0.04)


def tassel_parts():
    out = []
    for i, (ln, ph, amp) in enumerate(((0.19, 0.0, 0.012), (0.15, 2.1, 0.010), (0.12, 4.2, 0.008))):
        s = np.linspace(0, 1, 30)
        path = np.stack([amp * np.sin(2 * np.pi * (s * 1.3) + ph) * s, -0.060 - ln * s, 0.010 * np.cos(2 * np.pi * s * 1.1 + ph) * s], -1)
        out += sweep(path, 0.0075 * (1 - 0.45 * s), 0.0009, C=10, vscale=0.05, up=(1, 0, 0), caps=(True, True))
    return out


def build(out):
    seed = 51
    steel = NT.double_blade_textures(seed, "mirror", L)
    import forge_tex as FT
    champ = FT.aged_gold(seed + 1, tint=(0.88, 0.78, 0.56), rough=0.26)
    silk = FT.grip_leather(seed + 2, color=(0.62, 0.58, 0.50), stitch=(0.45, 0.40, 0.32))
    jade = FT.lacquer(seed + 3, color=(0.07, 0.24, 0.15), rough=0.16, orange=0.0)
    sets = {"Blade": (kit.double_blade(Y0, L, WF, TF), 25, pbr("mirror_steel_blade", steel, emissiveTexture=steel["emissive"], emissiveFactor=[1, 1, 1])),
            "Champagne": (guard_parts() + collar_parts() + pommel_parts(), 40, pbr("champagne_gilt", champ)),
            "Grip": (grip_parts(), 55, pbr("ivory_wrap", silk)),
            "Jade": (jade_parts(), 60, pbr("jade_bead", jade)),
            "Tassel": (tassel_parts(), 60, pbr("silk_tassel", silk))}
    return kit.assemble(Path(out) / "flying_sword_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
