"""Bô « Gardien » (bâton long de combat) -> GLB. Chêne rouge poli, deux prises cordées, viroles d'acier gravées de
losanges aux deux bouts, bagues de laiton perlées, anneau central riveté. ~1,80 m.
Repère : axe le long de Y, origine = centre du bâton. Usage : python3 gen_bo.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr  # noqa: E402
import forge_tex as FT  # noqa: E402
import sword_textures as TX  # noqa: E402
from sword_textures import fbm  # noqa: E402

sst = H.smoothstep
HL = 0.90                    # demi-longueur
H.SHIFT_Y = 0.0


def r_shaft(y):
    y = np.asarray(y, float)
    return 0.0152 - 0.0030 * (np.abs(y) / HL) ** 2.2


def wood_tex(seed, W=512, Ht=2048, tint=(0.34, 0.150, 0.060)):
    """Chêne rouge : fil allongé, cernes, nœuds rares, patine sombre et lisse là où les mains passent."""
    rng = np.random.default_rng(seed)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(Ht) + 0.5) / Ht
    y = (0.5 - v) * 2 * (HL - 0.10)
    g1 = fbm((Ht, W), (5, 60), rng, octs=4, tile=True)
    g2 = fbm((Ht, W), (14, 150), rng, octs=3, tile=True)
    rings = 0.5 + 0.5 * np.sin(2 * np.pi * (g1 * 9 + u[None, :] * 3))
    pores = (fbm((Ht, W), (90, 400), rng, octs=2, tile=True) > 0.72).astype(np.float32)
    scr = np.asarray(TX.scratches((Ht, W), rng, 160, along_rows=True, length=(40, 500), spread=0.05, cross=40), np.float32)
    scr = scr / max(scr.max(), 1e-6)
    hand = (np.exp(-((np.abs(y) - 0.33) / 0.17) ** 2))[:, None] * np.ones((1, W))   # zones de prise : patine sombre
    dent = fbm((Ht, W), (30, 20), rng, octs=3, tile=True)
    lum = 0.85 + 0.35 * (rings - 0.5) + 0.12 * (g2 - 0.5) - 0.28 * pores - 0.20 * hand * (0.5 + 0.5 * dent) + 0.08 * scr
    base = np.stack([tint[0] * lum, tint[1] * lum, tint[2] * lum], -1)
    rough = 0.34 + 0.10 * (g2 - 0.5) + 0.25 * pores - 0.12 * hand + 0.15 * scr
    h = 0.30 * rings + 0.10 * g2 - 0.5 * pores - 0.4 * scr + 0.15 * dent
    return dict(base=TX.to_img(base), mr=TX.mr_map(np.clip(rough, 0.18, 0.9), np.zeros((Ht, W), np.float32)), normal=TX.normal_map(h, 2.5))


def shaft_parts():
    ys = np.linspace(HL - 0.12, -(HL - 0.12), 60)
    prof = np.stack([ys, r_shaft(ys)], -1)
    return H.lathe(prof, 40, scale_v=2 * (HL - 0.10))


def wraps_parts():
    out = []
    for c in (0.33, -0.33):
        y0, y1 = c + 0.155, c - 0.155
        ys = np.linspace(y0, y1, 90)
        s = np.linspace(0, 1, 90)
        swell = 0.0012 + 0.0022 * np.minimum(1, np.minimum(s, 1 - s) / 0.04) ** 0.5
        prof = np.stack([ys, r_shaft(ys) + swell], -1)

        def weave(u, k, y):
            a = 0.5 + 0.5 * np.cos(2 * np.pi * (8 * u + (y0 - y) / 0.030))
            b = 0.5 + 0.5 * np.cos(2 * np.pi * (8 * u - (y0 - y) / 0.030))
            return 0.0013 * np.maximum(a, b) ** 1.4 - 0.0005
        out += H.lathe(prof, 44, scale_v=0.31, mod=weave)
    return out


def ferrule_parts():
    out = []
    for sg in (1, -1):
        ys = np.linspace(0.745, 0.900, 72)
        t = ys
        base = r_shaft(ys) + 0.0014
        bump = 0.0021 * (np.exp(-((ys - 0.772) / 0.0030) ** 2) + np.exp(-((ys - 0.792) / 0.0030) ** 2))
        flare = 0.0036 * sst(0.836, 0.868, ys)
        r = base + bump + flare
        d = np.clip((ys - 0.872) / 0.028, 0, 1)
        r = r * np.sqrt(np.clip(1 - d ** 2, 0, 1))
        r[0] = base[0]
        prof = np.stack([sg * ys, r], -1)

        def lattice(u, k, y):
            yy = abs(y)
            a = 0.5 + 0.5 * np.cos(2 * np.pi * (10 * u + yy / 0.012))
            b = 0.5 + 0.5 * np.cos(2 * np.pi * (10 * u - yy / 0.012))
            gate = sst(0.800, 0.806, yy) * (1 - sst(0.832, 0.838, yy))
            return -0.0013 * gate * (np.minimum(a, b) ** 2)
        out += H.lathe(prof, 48, scale_v=0.16, mod=lattice)
    return out


def brass_parts():
    out = []
    for sg in (1, -1):
        for y0, w in ((0.736, 0.018), (0.708, 0.010), (0.490 + 0.0, 0.0)):
            if w == 0:
                continue
            ys = np.linspace(y0 - w / 2, y0 + w / 2, 24)
            s = np.linspace(0, 1, 24)
            sw = 0.0010 + 0.0016 * np.sin(np.pi * s) ** 0.6
            prof = np.stack([sg * ys, r_shaft(ys) + sw + 0.0004], -1)
            pearl = lambda u, k, y: 0.0007 * (0.5 + 0.5 * np.cos(2 * np.pi * 16 * u)) ** 4 * (1 if 4 < k < 19 else 0)
            out += H.lathe(prof, 48, scale_v=0.03, mod=pearl)
        for y0 in (0.178, 0.488):                     # bagues aux extrémités des prises
            ys = np.linspace(y0 - 0.006, y0 + 0.006, 16)
            s = np.linspace(0, 1, 16)
            prof = np.stack([sg * ys, r_shaft(ys) + 0.0042 + 0.0012 * np.sin(np.pi * s) ** 0.7], -1)
            out += H.lathe(prof, 40, scale_v=0.03)
    return out


def center_ring():
    ys = np.linspace(0.026, -0.026, 40)
    s = np.linspace(0, 1, 40)
    prof = np.stack([ys, r_shaft(ys) + 0.0016 + 0.0020 * np.sin(np.pi * s) ** 0.35], -1)
    rivet = lambda u, k, y: 0.0021 * (np.cos(np.pi * 8 * u) ** 2) ** 6 * (1 if 12 < k < 27 else 0)
    return H.lathe(prof, 48, scale_v=0.06, mod=rivet)


def build(out):
    seed = 141
    iron = FT.dark_steel(seed + 1, lum=0.30, rough=0.38)
    brass = FT.aged_gold(seed + 2, tint=(0.74, 0.56, 0.28), rough=0.34)
    leather = FT.grip_leather(seed + 3, color=(0.085, 0.040, 0.026), stitch=(0.30, 0.20, 0.10))
    sets = {"Wood": (shaft_parts(), 30, pbr("oak_shaft", wood_tex(seed))),
            "Iron": (ferrule_parts() + center_ring(), 40, pbr("bo_iron", iron)),
            "Brass": (brass_parts(), 40, pbr("bo_brass", brass)),
            "Wrap": (wraps_parts(), 55, pbr("bo_cord", leather))}
    return kit.assemble(Path(out) / "bo_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
