"""Katana « Yugiri » (brume du soir) -> GLB. Lame trempée avec hamon, tsuba en fer, tsuka tressée en losanges.

Repère glTF : Y haut, pointe vers +Y, tranchant côté +X (courbure vers +X). Mètres. ~1,02 m.
Origine = centre de la tsuka (la poignée).

Usage : python3 gen_katana.py <dossier_sortie> [TEXTE]
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_naginata as G  # noqa: E402
import gen_sword_hd as H  # noqa: E402
import sword_textures as TX  # noqa: E402
import naginata_textures as NT  # noqa: E402
import forge_tex as FT  # noqa: E402
from PIL import Image  # noqa: E402

TSUKA_TOP, TSUKA_BOT = 0.292, 0.000
TSUKA_LEN = TSUKA_TOP - TSUKA_BOT
TS_N, TS_P = 2, 0.0270          # une rangée de ~11 losanges par face, comme sur la photo
WK = 1.30                        # proportions de la photo : lame et monture plus larges
CORD_POW = 1.0
Y0 = 0.300
H.SHIFT_Y = -TSUKA_LEN / 2

# --- on réutilise le noyau de lame du naginata en changeant ses dimensions ---
G.Y0, G.BLY, G.SORI = Y0, 0.72, 0.071       # flèche ~1,4 cm sur la lame, mesurée sur la photo de référence
G.TOP = [(1.0, 0.0), (0.90, 0.26), (0.52, 0.72), (0.18, 1.0), (-0.30, 0.985), (-0.75, 0.93), (-0.95, 0.80), (-1.0, 0.55)]
G.PROFILE = np.array(G.TOP + [(-1.02, 0.0)] + [(x, -z) for x, z in reversed(G.TOP[1:])])
G.curve_x = lambda t: -G.SORI * (0.70 * t ** 2 + 0.30 * (1 - (1 - t) ** 2) * t)
G.curve_dx = lambda t: -G.SORI * (1.40 * t + 0.30 * (2 * (1 - t) * t + (1 - (1 - t) ** 2))) / G.BLY


def _main(t):
    return WK * (0.0315 - 0.0070 * H.smoothstep(0.0, 0.92, t))


G.bw = lambda t: (lambda t: _main(t) * np.clip(1 - np.clip((t - 0.935) / 0.065, 0, 1) ** 1.8, 0, 1) ** 0.55)(np.asarray(t, float))
G.bw_main = lambda t: _main(np.asarray(t, float))
G.bt = lambda t: (lambda t: (0.0038 - 0.0012 * t) * (G.bw(t) / _main(t)) ** 0.8)(np.asarray(t, float))


def tsuka_r(y):
    return 0.0150 * WK, 0.0122 * WK   # section ovale (grand axe dans le plan de la lame)


def tsuka_parts(rows=130, C=44):
    s = np.linspace(0, 1, rows)
    ys = TSUKA_TOP - TSUKA_LEN * s
    u = np.arange(C) / C
    a = 2 * np.pi * u
    rings = np.zeros((rows, C, 3))
    for i in range(rows):
        y_rel = s[i] * TSUKA_LEN
        ra = (0.5 + 0.5 * np.cos(2 * np.pi * (TS_N * u + y_rel / TS_P))) ** CORD_POW
        rb = (0.5 + 0.5 * np.cos(2 * np.pi * (TS_N * u - y_rel / TS_P))) ** CORD_POW
        ridge = 0.0016 * np.maximum(ra, rb)
        bulge = 0.0011 * np.sin(np.pi * s[i]) ** 0.8
        rx, rz = tsuka_r(ys[i])
        rings[i] = np.stack([(rx + bulge + ridge) * np.cos(a), np.full(C, ys[i]), (rz + bulge + ridge) * np.sin(a)], -1)
    U = np.repeat(np.append(u, 1.0)[None, :], rows, axis=0)
    P, UV, F = H.grid_surface(rings, U, 1 - s)
    return [(P, UV, F), H.cap(rings[0], (0, 1, 0)), H.cap(rings[-1], (0, -1, 0))]


def tsuba_parts():
    prof = np.array([(-0.0022, 0.010), (-0.0030, 0.014), (-0.0030, 0.036), (-0.0020, 0.0405), (0.0, 0.0420),
                     (0.0020, 0.0405), (0.0030, 0.037), (0.0022, 0.032), (0.0022, 0.022), (0.0030, 0.016), (0.0034, 0.011)])
    prof[:, 0] += Y0 - 0.0035
    return H.lathe(prof, 96, scale_v=0.12)


def seppa_parts():
    out = []
    for y0, y1 in ((Y0 - 0.0066, Y0 - 0.0040), (Y0 + 0.0002, Y0 + 0.0030)):
        n = 6
        ys = np.linspace(y0, y1, n)
        k = np.array([0.9, 1, 1, 1, 1, 0.9])
        out += G.oval_tube(ys, 0.0215 * WK * k, 0.0150 * WK * k, C=32, scale_v=0.1)
    return out


def habaki_parts():
    ys = np.concatenate([[Y0 + 0.003], np.linspace(Y0 + 0.006, Y0 + 0.040, 10), [Y0 + 0.044, Y0 + 0.047]])
    k = np.concatenate([[0.82], np.linspace(1.0, 0.94, 10), [0.9, 0.8]])
    rx, rz = 0.0180 * WK * k, 0.0072 * WK * k
    groove = lambda u, i, y: -0.0009 * np.exp(-((y - (Y0 + 0.024)) / 0.0025) ** 2)
    return G.oval_tube(ys, rx, rz, C=32, scale_v=0.1, mod=groove)


def fuchi_parts():
    ys = np.linspace(TSUKA_TOP - 0.003, Y0 - 0.0066, 12)
    sw = 1 + 0.10 * np.sin(np.pi * np.linspace(0, 1, 12))
    return G.oval_tube(ys, (0.0150 * WK + 0.0032) * sw, (0.0122 * WK + 0.0032) * sw, C=40, scale_v=0.06)


def kashira_parts():
    ctrl = [(0.014, 0.0100), (0.004, 0.0172), (-0.004, 0.0178), (-0.013, 0.0165), (-0.021, 0.0120),
            (-0.027, 0.0062), (-0.0305, 0.0)]
    prof = H.catmull(ctrl, 22)
    prof[:, 1] = np.clip(prof[:, 1], 0, None) * WK
    rows = len(prof)
    C = 40
    a = 2 * np.pi * np.arange(C) / C
    ratio = 0.0122 / 0.0150
    rings = np.stack([np.stack([r * np.cos(a), np.full(C, y), r * ratio * np.sin(a)], -1) for y, r in prof])
    u = np.arange(C) / C
    U = np.repeat(np.append(u, 1.0)[None, :], rows, axis=0)
    V = 1 - (prof[:, 0] - prof[0, 0]) / 0.07
    P, UV, F = H.grid_surface(rings, U, V)
    return [(P, UV, F), H.cap(rings[0], (0, 1, 0))]


def menuki_parts():
    """Menuki : ornements dorés sous le tressage, décalés entre les deux faces."""
    out = []
    for sz, yc in ((1, 0.165), (-1, 0.128)):
        n = 22
        y = np.linspace(yc - 0.017, yc + 0.017, n)
        s = np.linspace(0, 1, n)
        w = 0.0056 * np.sin(np.pi * s) ** 0.55
        th = 0.0019 * np.sin(np.pi * s) ** 0.6
        from kit import sweep
        out += sweep(np.stack([np.zeros(n), y, np.full(n, sz * 0.0127 * WK)], -1), w, th, C=20, vscale=0.04, power=2.0, up=(1, 0, 0), caps=(True, True))
    return out


def etched(t, k=0.62):
    """Inscription gravée (non lumineuse) : on assombrit la base là où était l'émissif."""
    e = np.asarray(t["emissive"], np.float32).mean(-1, keepdims=True) / 255.0
    b = np.asarray(t["base"], np.float32) * (1 - k * np.clip(e * 1.5, 0, 1))
    mr = np.asarray(t["mr"], np.float32).copy()
    mr[..., 1:2] = np.clip(mr[..., 1:2] + 160 * np.clip(e * 1.5, 0, 1), 0, 255)
    return dict(base=Image.fromarray(b.astype(np.uint8)), mr=Image.fromarray(mr.astype(np.uint8)), normal=t["normal"])


# ------------------------------------------------------------------ fourreau (saya)
def saya_path(n=140):
    t = np.concatenate([np.linspace(-0.004 / G.BLY, 1.0, n - 10), np.linspace(1.0, 1.0 + 0.045 / G.BLY, 10)[1:]])
    x = G.curve_x(t) - 0.0010
    return np.stack([x, G.Y0 + G.BLY * t, np.zeros_like(t)], -1), t


def saya_sweep(p, t, add=0.0, caps=(False, False)):
    s = np.clip(t, 0, 1)
    rx = 0.0205 * WK - 0.0030 * s + add
    rz = 0.0136 * WK - 0.0018 * s + add
    from kit import sweep
    return sweep(p, rx, rz, C=40, vscale=0.25, power=2.3, up=(1, 0, 0), caps=caps)


def build_saya(out, seed):
    from kit import sweep, assemble, pbr
    p, t = saya_path()
    body = saya_sweep(p[4:-6], t[4:-6], caps=(True, True))
    horn = saya_sweep(p[:6], t[:6], add=0.0012, caps=(True, True))                       # koiguchi (embouchure en corne)
    pk, tk = p[-8:], t[-8:]
    s = np.linspace(0, 1, len(pk))
    from kit import sweep
    kr = (0.0175 * WK + 0.0010) * np.clip(1 - s ** 6, 0, 1) ** 0.35
    kz = (0.0118 * WK + 0.0010) * np.clip(1 - s ** 6, 0, 1) ** 0.35
    horn += sweep(pk, kr, kz, C=40, vscale=0.25, power=2.3, up=(1, 0, 0), caps=(True, False))   # kojiri (embout)
    # kurikata (tenon latéral) + sageo (cordon)
    i = 26
    c, d = p[i], p[i + 1] - p[i - 1]
    d /= np.linalg.norm(d)
    nrm = np.array([d[1], -d[0], 0.0])
    zf = 0.0136 * WK - 0.0018 * np.clip(t[i], 0, 1)
    m = 10
    q = c[None] + np.linspace(-0.012, 0.012, m)[:, None] * d[None] + (-0.004 * nrm)[None] + np.array([0, 0, zf + 0.0035])[None]
    pr = np.sin(np.pi * np.linspace(0, 1, m)) ** 0.3
    horn += sweep(q, 0.0050 * pr, 0.0042 * pr, C=20, vscale=0.05, power=3.0, up=(1, 0, 0), caps=(True, True))
    cord = []
    for side, off in ((1, 0.0), (-1, 0.006)):
        ctrl = [c + np.array([0, 0, zf + 0.0045]) - 0.004 * nrm,
                c + d * (-0.03 - off) + np.array([0, 0, zf + 0.010]) - (0.012 + off) * nrm,
                c + d * (-0.12 - off) + np.array([0, 0, zf + 0.016]) - (0.030 + off) * nrm,
                c + d * (-0.22 - off) + np.array([0, 0, zf + 0.012]) - (0.036 + off) * nrm]
        path = H.catmull(ctrl, 60)
        cord += sweep(path, 0.0055, 0.0011, C=12, vscale=0.3, power=2.6, up=(0, 0, 1), caps=(True, True))
    assemble(out / "katana_saya_hd.glb",
             {"Saya": (body, 30, pbr("saya_urushi", FT.lacquer(seed + 7, color=(0.030, 0.030, 0.033), rough=0.10, orange=0.05))),
              "Horn": (horn, 40, pbr("saya_horn", FT.lacquer(seed + 8, color=(0.045, 0.040, 0.036), rough=0.32, orange=0.15))),
              "Sageo": (cord, 50, pbr("saya_sageo", FT.braid(seed + 9, color=(0.06, 0.06, 0.07))))})


def build(out, text=None):
    text = text or " "
    seed = 31
    blade_p, _ = G.blade_parts()
    ur, perim = G.uref()
    steel = NT.blade_textures(seed, ur, perim, 0.72 * 1.02, text, y0=0.095, spacing=0.0175, sc=0.24, groove=False)
    steel = etched(steel)
    b = np.asarray(steel["base"], np.float32) / 255.0
    steel["base"] = Image.fromarray((np.clip(0.30 + 1.0 * b, 0, 0.93) * 255).astype(np.uint8))      # acier poli miroir
    mr = np.asarray(steel["mr"], np.float32).copy()
    mr[..., 1] = np.clip(mr[..., 1] * 0.75, 0, 255)
    steel["mr"] = Image.fromarray(mr.astype(np.uint8))
    gilt = FT.aged_gold(seed + 1)
    iron = FT.lacquer(seed + 2, color=(0.05, 0.05, 0.052), rough=0.30, orange=0.10, metal=0.6)
    tsuka = NT.tsuka_textures(seed + 3, TSUKA_LEN, TS_N, TS_P, cpow=CORD_POW, cord=(0.075, 0.075, 0.082), weave=0.45, nodules=True)

    def pbr(name, t, **kw):
        return PBRMaterial(name=name, baseColorTexture=t["base"], metallicRoughnessTexture=t["mr"],
                           normalTexture=t["normal"], metallicFactor=1.0, roughnessFactor=1.0, **kw)

    # la poignée prolonge la courbure de la lame (même rayon, vers le dos), comme sur la photo
    tt = 1e-3
    c = abs(float(G.curve_x(2 * tt) - 2 * G.curve_x(tt) + G.curve_x(0))) / (tt * G.BLY) ** 2
    YT = Y0 - 0.0035

    def bend(parts):
        out = []
        for P, UV, F in parts:
            P = P.copy()
            d = np.clip(YT - P[:, 1], 0, None)
            P[:, 0] -= 0.5 * c * d ** 2
            out.append((P, UV, F))
        return out

    sets = {"Blade": (blade_p, 25, pbr("steel_blade", steel)),
            "Gilt": (habaki_parts() + seppa_parts() + bend(menuki_parts()), 40, pbr("gilt_bronze", gilt)),
            "Iron": (tsuba_parts() + bend(fuchi_parts() + kashira_parts()), 45, pbr("dark_iron", iron)),
            "Tsuka": (bend(tsuka_parts()), 60, pbr("tsukamaki", tsuka))}
    scene = trimesh.Scene()
    for name, (parts, crease, mat) in sets.items():
        acc = H.Acc()
        for P, UV, F in parts:
            acc.add(P, UV, F)
        scene.add_geometry(acc.build(crease, mat), node_name=name, geom_name=name)
    out.mkdir(parents=True, exist_ok=True)
    build_saya(out, seed)
    path = out / "katana_hd.glb"
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
    for n, g in scene.geometry.items():
        m = trimesh.Trimesh(g.vertices.copy(), g.faces.copy(), process=True)
        m.merge_vertices()
        print(" ", n, len(g.faces), "étanche" if m.is_watertight else "NON étanche")
