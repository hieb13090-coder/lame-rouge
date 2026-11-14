"""Épée épique HD (surfaces lisses, textures PBR) -> GLB.

Repère glTF : Y haut, lame vers +Y, origine = centre de la poignée. Unités : mètres. ~1,35 m.

Usage : python3 gen_sword_hd.py <dossier_sortie>
"""
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sword_textures as TX  # noqa: E402

BL = 1.02                 # longueur de lame (de y=0 à la pointe)
GRIP_TOP, GRIP_LEN, WRAP_PITCH = -0.040, 0.222, 0.022
SHIFT_Y = -(GRIP_TOP - GRIP_LEN / 2)   # recale le centre de la poignée sur l'origine
FIRE = False                           # style feu (flamberge) ; fixé par build()


# ---------- outils de maillage ----------

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def grid_surface(rings, U, V):
    """rings (R,C,3) ; U (R,C+1) ; V (R,) -> sommets, uv, faces (couture dupliquée pour les UV)."""
    R, C, _ = rings.shape
    P = np.concatenate([rings, rings[:, :1]], axis=1)
    UV = np.stack([U, np.repeat(V[:, None], C + 1, axis=1)], -1)
    idx = np.arange(R * (C + 1)).reshape(R, C + 1)
    a, b, c, d = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    F = np.concatenate([np.stack([a, b, c], -1).reshape(-1, 3), np.stack([a, c, d], -1).reshape(-1, 3)])
    P = P.reshape(-1, 3)
    # orientation : normales vers l'extérieur (vote par rapport au centre de chaque anneau)
    centers = rings.mean(axis=1)
    tri = P[F]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    out = tri.mean(axis=1) - centers[F[:, 0] // (C + 1)]
    if np.einsum("ij,ij->i", n, out).sum() < 0:
        F = F[:, ::-1]
    return P, UV.reshape(-1, 2), F


def cap(ring, outward, scale=0.1):
    C = len(ring)
    c = ring.mean(axis=0)
    P = np.vstack([ring, c])
    UV = np.stack([(P[:, 0] - c[0]) / scale + 0.5, (P[:, 2] - c[2]) / scale + 0.5], -1)
    F = np.array([[i, (i + 1) % C, C] for i in range(C)])
    n = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]).sum(axis=0)
    if n @ np.asarray(outward) < 0:
        F = F[:, ::-1]
    return P, UV, F


def ring_uv(rings):
    """U = abscisse curviligne normalisée de chaque anneau (0..1, couture à 1)."""
    R, C, _ = rings.shape
    nxt = np.roll(rings, -1, axis=1)
    seg = np.linalg.norm(nxt - rings, axis=2)
    cum = np.concatenate([np.zeros((R, 1)), np.cumsum(seg, axis=1)], axis=1)
    per = cum[:, -1:]
    U = np.where(per > 1e-9, cum / np.maximum(per, 1e-9), np.linspace(0, 1, C + 1)[None, :])
    return U, per[:, 0]


def smooth_normals(P, F, crease_deg):
    tri = P[F]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    area = np.linalg.norm(fn, axis=1)
    fn = fn / np.maximum(area[:, None], 1e-30)
    keys = np.round(tri.reshape(-1, 3) * 1e6).astype(np.int64)
    _, inv = np.unique(keys, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    T = len(F)
    face_of = np.repeat(np.arange(T), 3)
    slot_of = np.tile(np.arange(3), T)
    groups = defaultdict(list)
    for ci, g in enumerate(inv):
        groups[g].append(ci)
    cos_c = np.cos(np.radians(crease_deg))
    N = np.zeros((T, 3, 3))
    for cis in groups.values():
        fs = face_of[cis]
        un = fn[fs]
        W = (un @ un.T >= cos_c).astype(float)
        acc = W @ (un * area[fs][:, None])
        acc /= np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-30)
        for j, ci in enumerate(cis):
            N[face_of[ci], slot_of[ci]] = acc[j]
    return N


class Acc:
    def __init__(self):
        self.P, self.UV, self.F, self.n = [], [], [], 0

    def add(self, P, UV, F):
        self.P.append(P)
        self.UV.append(UV)
        self.F.append(F + self.n)
        self.n += len(P)

    def build(self, crease, material):
        P = np.vstack(self.P).copy()
        P[:, 1] += SHIFT_Y
        UV, F = np.vstack(self.UV), np.vstack(self.F)
        tri = P[F]
        area = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1)
        F = F[area > 1e-12]
        N = smooth_normals(P, F, crease)
        verts, uv, nrm = P[F].reshape(-1, 3), UV[F].reshape(-1, 2), N.reshape(-1, 3)
        m = trimesh.Trimesh(vertices=verts, faces=np.arange(len(verts)).reshape(-1, 3), process=False)
        m.vertex_normals = nrm
        m.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
        return m


def catmull(points, n):
    """Courbe Catmull-Rom passant par les points (n échantillons)."""
    p = np.asarray(points, float)
    pad = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    ts = np.linspace(0, len(p) - 1, n)
    out = []
    for t in ts:
        i = min(int(t), len(p) - 2)
        f = t - i
        p0, p1, p2, p3 = pad[i], pad[i + 1], pad[i + 2], pad[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3))
    return np.array(out)


def lathe(profile, C, scale_v=0.1, rot=0.0, close_start=True, close_end=True, mod=None):
    """Solide de révolution autour de Y. profile : [(y, r), ...]. mod(i_u, row, y) -> delta rayon."""
    prof = np.asarray(profile, float)
    R = len(prof)
    u = np.arange(C) / C
    rings = np.zeros((R, C, 3))
    for k, (y, r) in enumerate(prof):
        rr = r + (mod(u, k, y) if mod else 0.0)
        a = 2 * np.pi * u + rot
        rings[k] = np.stack([rr * np.cos(a), np.full(C, y), rr * np.sin(a)], -1)
    dist = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(prof, axis=0), axis=1))])
    U = np.repeat(np.append(u, 1.0)[None, :], R, axis=0)
    V = 1 - dist / scale_v
    P, UV, F = grid_surface(rings, U, V)
    parts = [(P, UV, F)]
    if close_start and prof[0][1] > 1e-6:
        parts.append(cap(rings[0], (0, np.sign(prof[0][0] - prof[1][0]) or -1, 0)))
    if close_end and prof[-1][1] > 1e-6:
        parts.append(cap(rings[-1], (0, np.sign(prof[-1][0] - prof[-2][0]) or 1, 0)))
    return parts


# ---------- lame ----------

def blade_w(y):
    y = np.asarray(y, float)
    s = np.clip((y - 0.60) / (BL - 0.60), 0, 1)
    main = 0.070 - 0.010 * np.clip((y - 0.12) / 0.48, 0, 1)
    tip = 0.060 * np.clip(1 - s ** 2.2, 0, 1) ** 0.7
    w = np.where(y < 0.60, main, tip)
    if FIRE:
        env = smoothstep(0.14, 0.22, y) * (1 - smoothstep(0.70, 0.86, y))
        w = w + 0.009 * env * np.sin(2 * np.pi * (y - 0.14) / 0.105)
    return w


def blade_t(y):
    w = blade_w(y)
    return np.where(y < 0.60, 0.0058 - 0.0008 * np.clip(y / 0.6, 0, 1), 0.0050 * (w / 0.060) ** 0.7)


def blade_g(y):
    return 0.0022 * smoothstep(0.12, 0.17, y) * (1 - smoothstep(0.60, 0.70, y))


GX = np.linspace(-1, 1, 9)
XR = 0.38


def blade_ring(y):
    h, t, g = float(blade_w(y)) / 2, float(blade_t(y)), float(blade_g(y))
    gd = g * np.clip(1 - GX ** 2, 0, 1) ** 0.6
    top_x = [-1.0, -0.72, -0.55] + list(XR * GX) + [0.55, 0.72, 1.0]
    top_z = [0, t, t] + list(t - gd) + [t, t, 0]
    bot_x = [0.72, 0.55] + list(XR * GX[::-1]) + [-0.55, -0.72]
    bot_z = [-t, -t] + list(-(t - gd[::-1])) + [-t, -t]
    X = np.array(top_x + bot_x) * h
    Z = np.array(top_z + bot_z)
    return np.stack([X, np.full_like(X, y), Z], -1)


def blade_parts():
    if FIRE:   # lignes denses pour suivre les ondulations
        ys = np.concatenate([np.linspace(0, 0.12, 3, endpoint=False), np.linspace(0.12, 0.84, 120, endpoint=False),
                             0.84 + (BL - 0.84) * (1 - (1 - np.linspace(0, 1, 24)) ** 1.6)])
    else:
        ys = np.concatenate([
            np.linspace(0, 0.12, 3, endpoint=False), np.linspace(0.12, 0.20, 6, endpoint=False),
            np.linspace(0.20, 0.62, 14, endpoint=False), np.linspace(0.62, 0.72, 6, endpoint=False),
            0.72 + (BL - 0.72) * (1 - (1 - np.linspace(0, 1, 28)) ** 1.6)])
    rings = np.stack([blade_ring(y) for y in ys])
    U, per = ring_uv(rings)
    P, UV, F = grid_surface(rings, U, ys / BL)
    return [(P, UV, F), cap(rings[0], (0, -1, 0))], rings


# ---------- garde ----------

def boss_parts():
    ys = np.linspace(-0.038, 0.056, 22)
    yc, hh = 0.009, 0.047
    k = 0.50 + 0.50 * np.clip(1 - np.abs((ys - yc) / hh) ** 2, 0, 1) ** 0.5
    k = k * (1 - 0.06 * np.exp(-((ys - yc) / 0.004) ** 2))   # fine gorge décorative au centre
    C = 32
    a = 2 * np.pi * np.arange(C) / C + np.pi / C
    rings = np.stack([np.stack([0.044 * kk * np.cos(a), np.full(C, y), 0.023 * kk * np.sin(a)], -1) for kk, y in zip(k, ys)])
    U = np.repeat(np.append(np.arange(C) / C, 1.0)[None, :], len(ys), axis=0)
    V = 1 - (ys - ys[0]) / 0.10
    P, UV, F = grid_surface(rings, U, V)
    return [(P, UV, F), cap(rings[0], (0, -1, 0)), cap(rings[-1], (0, 1, 0))]


def quillon_parts(sign, rows=72, C=14, turns=1.75):
    L, amp, pw = (0.21, 0.060, 2.2) if FIRE else (0.19, 0.034, 2.0)
    if FIRE:
        turns, rows = 0.75, 80
    s = np.linspace(0, 1, rows)
    cx, cy = sign * (0.03 + L * s), amp * s ** pw
    tx, ty = sign * L * np.ones_like(s), amp * pw * s ** (pw - 1)
    ln = np.hypot(tx, ty)
    n1 = np.stack([-ty / ln, tx / ln], -1)
    n1 *= np.sign(n1[:, 1:2] + 1e-9)               # toujours orienté vers le haut
    if FIRE:   # renflement central puis pointe effilée : forme de langue de feu
        h = 0.0125 * (0.85 + 0.55 * np.sin(np.pi * np.minimum(s * 1.1, 1.0))) * np.clip((1 - s) / 0.14, 0, 1) ** 0.9
    else:
        h = 0.0125 * (1 - 0.35 * s ** 1.5) * np.clip((1 - s) / 0.12, 0, 1) ** 0.9
    ang = 2 * np.pi * turns * s + np.pi / 4
    phi = 2 * np.pi * np.arange(C) / C
    ex = np.sign(np.cos(phi)) * np.abs(np.cos(phi)) ** 0.5
    ez = np.sign(np.sin(phi)) * np.abs(np.sin(phi)) ** 0.5
    rings = np.zeros((rows, C, 3))
    for i in range(rows):
        a = ex * np.cos(ang[i]) - ez * np.sin(ang[i])
        b = ex * np.sin(ang[i]) + ez * np.cos(ang[i])
        rings[i, :, 0] = cx[i] + h[i] * a * n1[i, 0]
        rings[i, :, 1] = cy[i] + h[i] * a * n1[i, 1]
        rings[i, :, 2] = h[i] * b
    U = np.repeat(np.append(np.arange(C) / C, 1.0)[None, :], rows, axis=0)
    V = 1 - s * 3.8
    P, UV, F = grid_surface(rings, U, V)
    return [(P, UV, F), cap(rings[0], (-sign, 0, 0), 0.05)]


# ---------- poignée, bagues, pommeau ----------

def grip_parts(rows=88, C=30):
    s = np.linspace(0, 1, rows)
    ys = GRIP_TOP - GRIP_LEN * s
    u = np.arange(C) / C
    rings = np.zeros((rows, C, 3))
    for i in range(rows):
        r = 0.0145 + 0.0016 * np.sin(np.pi * s[i]) + 0.0013 * (0.5 + 0.5 * np.cos(2 * np.pi * (u + s[i] * GRIP_LEN / WRAP_PITCH))) ** 2
        a = 2 * np.pi * u
        rings[i] = np.stack([r * np.cos(a), np.full(C, ys[i]), r * np.sin(a)], -1)
    U = np.repeat(np.append(u, 1.0)[None, :], rows, axis=0)
    P, UV, F = grid_surface(rings, U, 1 - s)           # v = 1 - y_rel/L (cohérent avec la texture)
    return [(P, UV, F), cap(rings[0], (0, 1, 0)), cap(rings[-1], (0, -1, 0))]


def band_parts(y0, y1, r=0.0195):
    prof = [(y0, r * 0.84), (y0 - 0.0018, r), (y1 + 0.0018, r), (y1, r * 0.84)]
    return lathe(prof, 32)


def pommel_parts():
    if FIRE:
        ctrl = [(-0.262, 0.0165), (-0.272, 0.0170), (-0.280, 0.030), (-0.292, 0.0375), (-0.306, 0.033),
                (-0.322, 0.022), (-0.340, 0.011), (-0.355, 0.0045), (-0.368, 0.0)]
        gy = -0.292
    else:
        ctrl = [(-0.262, 0.0165), (-0.272, 0.0170), (-0.277, 0.030), (-0.286, 0.0405), (-0.298, 0.0425),
                (-0.311, 0.036), (-0.321, 0.022), (-0.327, 0.009), (-0.3295, 0.0)]
        gy = -0.298
    prof = catmull(ctrl, 36)
    prof[:, 1] = np.clip(prof[:, 1], 0, None)
    groove = lambda u, k, y: -0.0030 * np.exp(-((y - gy) / 0.0022) ** 2)
    return lathe(prof, 32, scale_v=0.12, mod=groove)


# ---------- assemblage ----------

def build(out, style="steel", text=None):
    global FIRE
    FIRE = style == "fire"
    text = text or ("BRASIER" if FIRE else "AURORE")
    TX_SEED = 11
    blade_p, _ = blade_parts()
    r = blade_ring(0.36)
    perim_ref = float(np.linalg.norm(np.roll(r, -1, axis=0) - r, axis=1).sum())
    if FIRE:
        steel = TX.fire_steel_textures(TX_SEED, perim_ref, BL, text)
        iron = TX.iron_textures(TX_SEED + 1, fire=True)
        leather = TX.leather_textures(TX_SEED + 2, GRIP_LEN, WRAP_PITCH, tint=(0.20, 0.07, 0.06))
    else:
        steel = TX.steel_textures(TX_SEED, perim_ref, BL, text)
        iron = TX.iron_textures(TX_SEED + 1)
        leather = TX.leather_textures(TX_SEED + 2, GRIP_LEN, WRAP_PITCH)

    M_steel = PBRMaterial(name="steel_blade", baseColorTexture=steel["base"], metallicRoughnessTexture=steel["mr"],
                          normalTexture=steel["normal"], emissiveTexture=steel["emissive"],
                          emissiveFactor=[1.0, 1.0, 1.0], metallicFactor=1.0, roughnessFactor=1.0)
    iron_kw = dict(emissiveTexture=iron["emissive"], emissiveFactor=[1.0, 1.0, 1.0]) if "emissive" in iron else {}
    M_iron = PBRMaterial(name="dark_iron", baseColorTexture=iron["base"], metallicRoughnessTexture=iron["mr"],
                         normalTexture=iron["normal"], metallicFactor=1.0, roughnessFactor=1.0, **iron_kw)
    M_leather = PBRMaterial(name="leather_wrap", baseColorTexture=leather["base"], metallicRoughnessTexture=leather["mr"],
                            normalTexture=leather["normal"], metallicFactor=1.0, roughnessFactor=1.0)

    sets = {"Blade": (blade_p, 25, M_steel),
            "Guard": (boss_parts() + quillon_parts(+1) + quillon_parts(-1), 45, M_iron),
            "Grip": (grip_parts(), 55, M_leather),
            "Fittings": (band_parts(-0.040, -0.054) + band_parts(-0.248, -0.262), 50, M_iron),
            "Pommel": (pommel_parts(), 50, M_iron)}
    scene = trimesh.Scene()
    for name, (parts, crease, mat) in sets.items():
        acc = Acc()
        for P, UV, F in parts:
            acc.add(P, UV, F)
        scene.add_geometry(acc.build(crease, mat), node_name=name, geom_name=name)
    out.mkdir(parents=True, exist_ok=True)
    path = out / ("sword_fire_hd.glb" if FIRE else "sword_epic_hd.glb")
    scene.export(path, include_normals=True)
    return scene, path


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    style = sys.argv[2] if len(sys.argv) > 2 else "steel"
    text = " ".join(sys.argv[3:]) or None
    scene, path = build(out, style, text)
    tris = sum(len(g.faces) for g in scene.geometry.values())
    print(f"OK : {tris} triangles, {len(scene.geometry)} pièces -> {path} ({path.stat().st_size/1e6:.1f} Mo)")
