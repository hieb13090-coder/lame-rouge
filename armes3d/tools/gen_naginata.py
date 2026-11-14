"""Naginata épique « Tsukikage » (ombre de lune) -> GLB.

Repère glTF : Y haut, pointe vers +Y, lame plate dans le plan XY, courbure vers +X (côté tranchant).
Unités : mètres. Longueur totale ~2,27 m. Origine = centre de l'enroulement avant (main avant).

Usage : python3 gen_naginata.py <dossier_sortie> [TEXTE]
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_sword_hd as H  # noqa: E402
import sword_textures as TX  # noqa: E402
import naginata_textures as NT  # noqa: E402

smoothstep = H.smoothstep

# ---- dimensions ----
Y0 = 1.52            # début de la lame (face supérieure de la tsuba)
BLY = 0.66           # étendue de la lame en Y
SORI = 0.080         # déport de la pointe vers +X (courbure)
POLE_TOP = Y0 - 0.075
WRAP_LEN, WRAP_PITCH = 0.30, 0.022
WRAPS = [(0.22, 0.52), (0.95, 1.25)]
ORIGIN_Y = 1.10
H.SHIFT_Y = -ORIGIN_Y


# ---------- lame courbe à shinogi, gouttière et pointe ----------

def curve_x(t):
    # signe négatif : la lame se courbe vers le dos (mune), le tranchant (+X) est du côté bombé
    return -SORI * (0.78 * t ** 2 + 0.22 * t ** 3)


def curve_dx(t):
    return -SORI * (1.56 * t + 0.66 * t ** 2) / BLY


def bw_main(t):
    t = np.asarray(t, float)
    return 0.050 + 0.019 * H.smoothstep(0.0, 0.42, t) - 0.007 * H.smoothstep(0.45, 0.84, t)


def bw(t):
    t = np.asarray(t, float)
    main = bw_main(t)
    s2 = np.clip((t - 0.84) / 0.16, 0, 1)
    return main * np.clip(1 - s2 ** 2.0, 0, 1) ** 0.55


def bt(t):
    t = np.asarray(t, float)
    main = 0.050 + 0.019 * H.smoothstep(0.0, 0.42, t) - 0.007 * H.smoothstep(0.45, 0.84, t)
    return (0.0056 - 0.0018 * t) * (bw(t) / main) ** 0.8


GD = 0.38      # profondeur relative de la gouttière
TOP = [(1.0, 0.0), (0.90, 0.26), (0.52, 0.72), (0.18, 1.0), (0.0, 1.0), (-0.20, 1.0), (-0.28, 1 - 0.5 * GD),
       (-0.40, 1 - GD), (-0.56, 1 - GD), (-0.68, 1 - 0.5 * GD), (-0.76, 1.0), (-0.88, 0.98), (-0.96, 0.84), (-1.0, 0.55)]
PROFILE = np.array(TOP + [(-1.02, 0.0)] + [(x, -z) for x, z in reversed(TOP[1:])])


def blade_ring(t):
    hw, th = float(bw(t)) / 2, float(bt(t))
    cx, d = curve_x(t), curve_dx(t)
    nrm = np.array([1.0, -d, 0.0]) / np.hypot(1, d)
    # pointe : le dos (mune) reste continu jusqu'à la pointe, c'est le tranchant qui remonte (fukura)
    shift = -1.02 * (float(bw_main(t)) / 2 - hw)
    c = np.array([cx, Y0 + BLY * t, 0.0]) + shift * nrm
    return c[None, :] + (PROFILE[:, 0] * hw)[:, None] * nrm[None, :] + (PROFILE[:, 1] * th)[:, None] * np.array([0, 0, 1.0])[None, :]


def blade_parts():
    ts = np.concatenate([np.linspace(0, 0.30, 36, endpoint=False), np.linspace(0.30, 0.84, 80, endpoint=False),
                         0.84 + 0.16 * (1 - (1 - np.linspace(0, 1, 46)) ** 1.7)])
    rings = np.stack([blade_ring(t) for t in ts])
    U, per = H.ring_uv(rings)
    P, UV, F = H.grid_surface(rings, U, ts)
    return [(P, UV, F), H.cap(rings[0], (0, -1, 0))], rings


def uref(perim_t=0.30):
    """Positions u (0..1 autour de la section) des repères de texture à t donné."""
    r = blade_ring(perim_t)
    seg = np.linalg.norm(np.roll(r, -1, axis=0) - r, axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    per = cum[-1]

    def u_at(x):    # u d'un point du profil supérieur à l'abscisse relative x (interpolation)
        for i in range(len(TOP) - 1):
            x0, x1 = TOP[i][0], TOP[i + 1][0]
            if x1 <= x <= x0:
                f = (x0 - x) / (x0 - x1)
                return (cum[i] + f * seg[i]) / per
        return 0.5
    return dict(ham=u_at(0.78), ridge=u_at(0.18), g0=u_at(-0.24), g1=u_at(-0.72), text=u_at(0.42)), per


# ---------- tubes ovales (hampe, habaki, bagues) ----------

def oval_tube(ys, rx, rz, C=28, scale_v=0.2, caps=True, mod=None, rot=0.0):
    """Tube ovale le long de Y. rx, rz : tableaux (par rangée). mod(u, k, y) -> delta de rayon."""
    ys = np.asarray(ys, float)
    u = np.arange(len(ys) and C) / C
    rings = np.zeros((len(ys), C, 3))
    for k, y in enumerate(ys):
        d = mod(u, k, y) if mod else 0.0
        a = 2 * np.pi * u + rot
        rings[k] = np.stack([(rx[k] + d) * np.cos(a), np.full(C, y), (rz[k] + d) * np.sin(a)], -1)
    U = np.repeat(np.append(u, 1.0)[None, :], len(ys), axis=0)
    V = 1 - (ys - ys[0]) / scale_v
    P, UV, F = H.grid_surface(rings, U, V)
    parts = [(P, UV, F)]
    if caps:
        parts.append(H.cap(rings[0], (0, -1, 0)))
        parts.append(H.cap(rings[-1], (0, 1, 0)))
    return parts


def band(y0, y1, rx, rz, swell=0.0022):
    ys = np.array([y0, y0 + swell * 0.8, y0 + swell * 1.6, (y0 + y1) / 2, y1 - swell * 1.6, y1 - swell * 0.8, y1])
    k = np.array([0.85, 1.0, 1.0, 1.0, 1.0, 1.0, 0.85])
    return oval_tube(ys, (rx + 0.003) * np.ones(7) * k, (rz + 0.003) * np.ones(7) * k, scale_v=0.04)


def pole_r(y):
    f = np.clip(np.asarray(y) / POLE_TOP, 0, 1)
    return 0.0148 + 0.0016 * f, 0.0132 + 0.0014 * f


def pole_parts():
    ys = np.linspace(0.02, POLE_TOP, 60)
    rx, rz = pole_r(ys)
    parts = oval_tube(ys, rx, rz, C=32, scale_v=POLE_TOP)
    # V = y / longueur : même convention que la texture (ligne 0 = haut)
    out = []
    for P, UV, F in parts:
        UV = UV.copy()
        out.append((P, UV, F))
    return out


def pole_parts_v():
    ys = np.linspace(0.02, POLE_TOP, 60)
    rx, rz = pole_r(ys)
    C = 32
    u = np.arange(C) / C
    a = 2 * np.pi * u
    rings = np.stack([np.stack([rx[k] * np.cos(a), np.full(C, y), rz[k] * np.sin(a)], -1) for k, y in enumerate(ys)])
    U = np.repeat(np.append(u, 1.0)[None, :], len(ys), axis=0)
    V = ys / POLE_TOP
    P, UV, F = H.grid_surface(rings, U, V)
    return [(P, UV, F), H.cap(rings[0], (0, -1, 0)), H.cap(rings[-1], (0, 1, 0))]


def wrap_parts(y_top, y_bot, rows=80, C=32):
    s = np.linspace(0, 1, rows)
    ys = y_top - (y_top - y_bot) * s
    u = np.arange(C) / C
    a = 2 * np.pi * u
    rings = np.zeros((rows, C, 3))
    for i in range(rows):
        rx, rz = pole_r(ys[i])
        ridge = 0.0013 * (0.5 + 0.5 * np.cos(2 * np.pi * (u + s[i] * WRAP_LEN / WRAP_PITCH))) ** 2
        env = 0.0009 + 0.0007 * np.sin(np.pi * s[i])
        rings[i] = np.stack([(rx + env + ridge) * np.cos(a), np.full(C, ys[i]), (rz + env + ridge) * np.sin(a)], -1)
    U = np.repeat(np.append(u, 1.0)[None, :], rows, axis=0)
    P, UV, F = H.grid_surface(rings, U, 1 - s)
    return [(P, UV, F), H.cap(rings[0], (0, 1, 0)), H.cap(rings[-1], (0, -1, 0))]


# ---------- garde (tsuba lobée), habaki, collier, culot ----------

def tsuba_parts():
    prof = np.array([(-0.0030, 0.014), (-0.0042, 0.020), (-0.0042, 0.054), (-0.0030, 0.0625), (0.0, 0.0648),
                     (0.0030, 0.0625), (0.0042, 0.056), (0.0030, 0.049), (0.0030, 0.034), (0.0052, 0.026),
                     (0.0070, 0.0195)])
    prof[:, 0] += Y0
    lobe = lambda u, k, y: 0.0050 * np.cos(2 * np.pi * 8 * u) * H.smoothstep(0.044, 0.062, prof[k][1])
    return H.lathe(prof, 96, scale_v=0.20, mod=lobe)


def habaki_parts():
    ys = np.concatenate([[Y0 + 0.003], np.linspace(Y0 + 0.006, Y0 + 0.068, 12), [Y0 + 0.074, Y0 + 0.078]])
    k = np.concatenate([[0.82], np.linspace(1.0, 0.92, 12), [0.90, 0.78]])
    rx, rz = 0.0345 * k, 0.0105 * k
    groove = lambda u, i, y: -0.0014 * np.exp(-((y - (Y0 + 0.040)) / 0.0035) ** 2)
    return oval_tube(ys, rx, rz, C=32, scale_v=0.2, mod=groove)


def collar_parts():
    ys = np.linspace(POLE_TOP - 0.008, Y0 - 0.0045, 14)
    sw = 1 + 0.22 * np.sin(np.pi * np.linspace(0, 1, 14)) ** 1.2
    rx, rz = pole_r(ys)
    return oval_tube(ys, (rx + 0.004) * sw, (rz + 0.004) * sw, C=32, scale_v=0.2)


def ishizuki_parts():
    ctrl = [(0.100, 0.0172), (0.060, 0.0194), (0.025, 0.0200), (0.000, 0.0182), (-0.020, 0.0150), (-0.045, 0.0102),
            (-0.070, 0.0046), (-0.088, 0.0)]
    prof = H.catmull(ctrl, 30)
    prof[:, 1] = np.clip(prof[:, 1], 0, None)
    return H.lathe(prof, 32, scale_v=0.2)


# ---------- assemblage ----------

def build(out, text=None):
    text = text or "TSUKIKAGE"
    seed = 21
    blade_p, _ = blade_parts()
    ur, perim = uref()
    steel = NT.blade_textures(seed, ur, perim, BLY * 1.02, text)
    import forge_tex as FT
    steel = FT.etched(steel)
    gilt = FT.aged_gold(seed + 1)
    iron = FT.dark_steel(seed + 2, lum=0.27, rough=0.45)
    pole = NT.pole_textures(seed + 3, POLE_TOP)
    cord = TX.leather_textures(seed + 4, WRAP_LEN, WRAP_PITCH, tint=(0.36, 0.045, 0.055))

    def pbr(name, t, **kw):
        return PBRMaterial(name=name, baseColorTexture=t["base"], metallicRoughnessTexture=t["mr"],
                           normalTexture=t["normal"], metallicFactor=1.0, roughnessFactor=1.0, **kw)

    M_blade = pbr("steel_blade", steel)
    M_gilt = pbr("gilt_bronze", gilt)
    M_iron = pbr("dark_iron", iron)
    M_pole = pbr("urushi_pole", pole)
    M_cord = pbr("ito_wrap", cord)

    bands = []
    for yt, yb in WRAPS:
        for y in (yt + 0.010, yb - 0.002):
            rx, rz = pole_r(y)
            bands += band(y - 0.010, y, rx, rz)
    for y in (0.66, 0.74, 0.82, 0.90):          # petits anneaux décoratifs entre les deux enroulements
        rx, rz = pole_r(y)
        bands += band(y, y + 0.007, rx, rz, swell=0.0015)
    for y in (1.30, 1.38):
        rx, rz = pole_r(y)
        bands += band(y, y + 0.010, rx, rz, swell=0.0018)

    sets = {"Blade": (blade_p, 25, M_blade),
            "Gilt": (habaki_parts() + collar_parts() + bands, 40, M_gilt),
            "Pole": (pole_parts_v(), 60, M_pole),
            "Wrap": (sum([wrap_parts(yt, yb) for yt, yb in WRAPS], []), 55, M_cord),
            "Butt": (ishizuki_parts() + tsuba_parts(), 45, M_iron)}
    scene = trimesh.Scene()
    for name, (parts, crease, mat) in sets.items():
        acc = H.Acc()
        for P, UV, F in parts:
            acc.add(P, UV, F)
        scene.add_geometry(acc.build(crease, mat), node_name=name, geom_name=name)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "naginata_hd.glb"
    scene.export(path, include_normals=True)
    return scene, path


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    text = " ".join(sys.argv[2:]) or None
    scene, path = build(out, text)
    tris = sum(len(g.faces) for g in scene.geometry.values())
    b = scene.bounds
    print(f"OK : {tris} triangles, {len(scene.geometry)} pièces -> {path} ({path.stat().st_size/1e6:.1f} Mo)")
    print("dimensions (m) :", np.round(b[1] - b[0], 3), " y :", round(b[0][1], 3), "->", round(b[1][1], 3))
