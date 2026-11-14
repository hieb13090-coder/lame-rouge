"""Bouclier rond « Rempart » : disque bombé de 0,80 m, 8 nervures rayonnantes, 3 anneaux en relief, champs en laque cramoisie, bord et umbo en bronze,
pointe centrale, rivets, poignée et sangles de bras au dos (conception originale) -> GLB.
Repère : Y en haut, face avant vers +Z, plan du bord z = 0, sommet du dôme z = +0,085, origine = centre du disque. Le bras se glisse côté -Z (dos concave).
Usage : python3 gen_shield.py <dossier>"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, capsule_profile, taper_profile  # noqa: E402
import forge_tex as FT  # noqa: E402
import sword_textures as TX  # noqa: E402

H.SHIFT_Y = 0.0
R = 0.40            # rayon
ZC = 0.085          # hauteur du dôme au centre
NR, NC = 100, 200   # maillage de la face avant
sstep = H.smoothstep


def dome(r):
    return ZC * (1.0 - np.clip(r / R, 0, 1) ** 2.2)


def relief(r, th):
    """Nervures (8) + 3 anneaux en relief + bourrelet de bord, sur la face avant."""
    c = (1 + np.cos(8 * th)) / 2
    win = sstep(0.115, 0.15, r) * (1 - sstep(0.365, 0.385, r))
    rib = 0.0125 * c ** 6 * win
    rings = sum(a * np.exp(-((r - r0) / s) ** 2) for r0, s, a in ((0.20, 0.0075, 0.0065), (0.30, 0.0075, 0.0065), (0.352, 0.010, 0.0085)))
    edge = 0.004 * sstep(0.375, 0.40, r)
    return rib + rings + edge


def front_h(r, th):
    return dome(r) + relief(r, th)


def back_h(r):
    return dome(r) - 0.011 - 0.003 * sstep(0.30, 0.40, r)


def polar_surface(hfun, rows, C, front):
    rs = np.linspace(0, R, rows)
    th = 2 * np.pi * np.arange(C + 1) / C
    RR, TH = np.meshgrid(rs, th, indexing="ij")
    Z = hfun(RR, TH)
    P = np.stack([RR * np.cos(TH), RR * np.sin(TH), Z], -1)
    UV = np.stack([TH / (2 * np.pi), RR / R], -1).reshape(-1, 2)
    idx = np.arange(rows * (C + 1)).reshape(rows, C + 1)
    a, b, c, d = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    F = np.concatenate([np.stack([a, b, c], -1).reshape(-1, 3), np.stack([a, c, d], -1).reshape(-1, 3)])
    P = P.reshape(-1, 3)
    tri = P[F]
    nz = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])[:, 2]
    if (nz.sum() > 0) != front:
        F = F[:, ::-1]
    return [(P, UV, F)]


def faces():
    front = polar_surface(front_h, NR, NC, True)
    back = polar_surface(lambda r, th: back_h(r), 44, 96, False)
    return front, back


def rot_z(parts, z0):
    """Pièce de révolution autour de Y -> autour de Z (pôle +Y vers +Z), posée à z0."""
    return kit.xf(parts, lambda P: np.stack([P[:, 0], -P[:, 2], P[:, 1] + z0], -1))


def boss():
    prof = [(-0.006, 0.112), (0.000, 0.112), (0.008, 0.108), (0.016, 0.100), (0.030, 0.082), (0.044, 0.056), (0.054, 0.032), (0.060, 0.013), (0.064, 0.0)]
    base = H.lathe(H.catmull(prof, 44), 72, scale_v=0.08, close_start=True, close_end=False)
    spike = H.lathe(H.catmull([(0.058, 0.014), (0.080, 0.010), (0.108, 0.005), (0.142, 0.0)], 22), 32, scale_v=0.05, close_start=False, close_end=False)
    ring = H.lathe(H.catmull([(0.000, 0.124), (0.006, 0.130), (0.013, 0.126), (0.016, 0.116), (0.008, 0.112)], 20), 72, scale_v=0.05, close_start=False, close_end=False)
    return rot_z(base + spike + ring, dome(0.0) - 0.004)


def rivets():
    out = []
    prof = H.catmull([(0.0, 0.0090), (0.0030, 0.0084), (0.0058, 0.0058), (0.0076, 0.0)], 8)
    proto = H.lathe(prof, 14, scale_v=0.04, close_start=True, close_end=False)
    for ring_r, n, ph in ((0.375, 32, 0.0), (0.158, 8, np.pi / 8), (0.255, 8, np.pi / 8)):
        for i in range(n):
            a = 2 * np.pi * i / n + ph
            z = float(front_h(ring_r, a)) - 0.002
            ca, sa = np.cos(a), np.sin(a)
            out += kit.xf(proto, lambda P, ca=ca, sa=sa, z=z, rr=ring_r: np.stack([P[:, 0] + rr * ca, -P[:, 2] + rr * sa, P[:, 1] + z], -1))
    return out


def rim():
    p = kit.circle_path((0, 0, -0.0045), R + 0.0015, n=140, plane="xy", a0=0.0, a1=2 * np.pi * 0.9995)
    return sweep(p, 0.0175, 0.0175, C=22, vscale=0.05, power=2.0, up=(0, 0, 1))


def back_z(x, y):
    r = float(np.hypot(x, y))
    return float(back_h(r))


def back_hardware():
    """Poignée (cuir) + 2 supports acier + 2 sangles de bras (cuir). Renvoie (cuir, acier)."""
    leather, steel = [], []
    hx, hz = 0.150, 0.026
    n = 24
    path = np.stack([np.full(n, hx), np.linspace(-0.080, 0.080, n), np.full(n, hz)], -1)
    leather += sweep(path, capsule_profile(n, 0.0155), capsule_profile(n, 0.0155), C=28, vscale=0.06, up=(1, 0, 0), caps=(True, True))
    for sy in (-0.078, 0.078):
        m = 12
        zt = back_z(hx, sy)
        p = np.stack([np.full(m, hx), np.full(m, sy), np.linspace(zt + 0.004, hz, m)], -1)
        steel += sweep(p, 0.011, 0.007, C=16, vscale=0.05, power=3.0, up=(1, 0, 0), caps=(True, True))
    for x0, half, arch in ((-0.075, 0.115, 0.050), (-0.215, 0.085, 0.040)):
        m = 30
        y = np.linspace(-half, half, m)
        zt = np.array([back_z(x0, yy) for yy in y])
        z = zt - arch * (1 - (y / half) ** 2) ** 0.7 + 0.004
        p = np.stack([np.full(m, x0), y, z], -1)
        leather += sweep(p, 0.021, 0.0042, C=18, vscale=0.05, power=3.4, up=(1, 0, 0), caps=(True, True))
    return leather, steel


def shield_textures(seed, W=2048, Hh=1024):
    """Texture polaire de la face avant : u = angle, v = rayon/R. Retourne dict(base, mr, normal)."""
    rng = np.random.default_rng(seed)
    x = (np.arange(W) + 0.5) / W
    y = (np.arange(Hh) + 0.5) / Hh
    TH, RRn = np.meshgrid(2 * np.pi * x, y)       # (Hh, W)
    Rr = RRn * R
    c = (1 + np.cos(8 * TH)) / 2
    rib = c ** 6
    zone = sstep(0.115, 0.15, Rr) * (1 - sstep(0.365, 0.385, Rr))
    ringm = np.zeros_like(Rr)
    for r0, s in ((0.20, 0.010), (0.30, 0.010), (0.352, 0.013)):
        ringm = np.maximum(ringm, np.exp(-((Rr - r0) / s) ** 2))
    steel_m = np.clip(np.maximum.reduce([rib * zone * 1.6, ringm, 1 - zone]), 0, 1)
    steel_m = sstep(0.35, 0.65, steel_m)
    field = 1 - steel_m                                        # champ laqué
    fine = TX.fbm((Hh, W), (10, 24), rng, octs=4)
    grain = TX.fbm((Hh, W), (60, 120), rng, octs=2)
    mott = TX.fbm((Hh, W), (6, 6), rng, octs=5)
    # gravure en rayons dans les champs (64 filets)
    ray = np.abs(np.cos(32 * TH + 0.4 * np.sin(6 * Rr / R * np.pi))) ** 40
    lac = np.stack([0.30 + 0.05 * fine, 0.022 + 0.01 * fine, 0.030 + 0.012 * fine], -1)
    lac = lac * (1 - 0.35 * ray[..., None] * field[..., None])
    ste = np.stack([0.16 + 0.05 * mott, 0.17 + 0.05 * mott, 0.19 + 0.05 * mott], -1) * (1 + 0.12 * (grain[..., None] - 0.5))
    # filet bronze le long des nervures
    edge = np.clip(1 - np.abs(rib - 0.28) / 0.05, 0, 1) * zone
    bron = np.array([0.62, 0.45, 0.24])
    base = lac * field[..., None] + ste * steel_m[..., None]
    base = base * (1 - edge[..., None]) + bron * edge[..., None]
    rough = field * (0.20 + 0.10 * fine) + steel_m * (0.36 + 0.14 * (mott - 0.5))
    rough = rough * (1 - edge) + 0.30 * edge
    metal = steel_m * 0.96 * (1 - edge) + edge * 1.0
    mr = np.zeros((Hh, W, 3), np.float32)
    mr[..., 1] = np.clip(rough, 0.08, 0.95)
    mr[..., 2] = metal
    h = 0.35 * (grain - 0.5) + 0.20 * (mott - 0.5) - 0.55 * ray * field + 0.25 * fine * field
    return dict(base=TX.to_img(np.clip(base, 0, 1)), mr=Image.fromarray((np.clip(mr, 0, 1) * 255).astype(np.uint8)), normal=TX.normal_map(h, 3.0))


def build(out):
    seed = 404
    front, back = faces()
    leather, hsteel = back_hardware()
    sets = {"Front": (front, 35, pbr("rempart_face", shield_textures(seed))),
            "Back": (back + hsteel, 40, pbr("rempart_back", FT.dark_steel(seed + 1, lum=0.20))),
            "Trim": (boss() + rivets() + rim(), 45, pbr("rempart_bronze", FT.aged_gold(seed + 2, tint=(0.62, 0.45, 0.25), rough=0.34))),
            "Leather": (leather, 60, pbr("rempart_leather", FT.grip_leather(seed + 3, color=(0.15, 0.08, 0.05))))}
    kit.assemble(Path(out) / "shield_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
