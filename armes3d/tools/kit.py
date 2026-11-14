"""Outils communs aux armes : balayage de tubes, lames à deux tranchants, assemblage GLB."""
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_sword_hd as H  # noqa: E402

sstep = H.smoothstep


def pbr(name, t, **kw):
    return PBRMaterial(name=name, baseColorTexture=t["base"], metallicRoughnessTexture=t["mr"],
                       normalTexture=t["normal"], metallicFactor=1.0, roughnessFactor=1.0, **kw)


def sweep(path, rx, ry, C=28, vscale=0.12, power=2.0, up=(0, 1, 0), caps=(False, False), delta=None, rot=0.0):
    """Tube le long d'une courbe. rx : demi-axe selon la normale N, ry : selon B (tableaux ou scalaires).
    power>2 donne une section plus carrée. delta(u, k) ajoute un décalage de rayon."""
    P = np.asarray(path, float)
    n = len(P)
    rx = np.broadcast_to(np.asarray(rx, float), (n,))
    ry = np.broadcast_to(np.asarray(ry, float), (n,))
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    N = np.zeros_like(T)
    n0 = np.asarray(up, float) - np.dot(up, T[0]) * T[0]
    N[0] = n0 / np.linalg.norm(n0)
    for k in range(1, n):
        v = N[k - 1] - np.dot(N[k - 1], T[k]) * T[k]
        N[k] = v / np.linalg.norm(v)
    B = np.cross(T, N)
    u = np.arange(C) / C
    a = 2 * np.pi * u + rot
    ca, sa = np.cos(a), np.sin(a)
    ex = np.sign(ca) * np.abs(ca) ** (2 / power)
    ey = np.sign(sa) * np.abs(sa) ** (2 / power)
    rings = np.zeros((n, C, 3))
    for k in range(n):
        d = delta(u, k) if delta else 0.0
        rings[k] = P[k] + ((rx[k] + d) * ex)[:, None] * N[k] + ((ry[k] + d) * ey)[:, None] * B[k]
    dist = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    U = np.repeat(np.append(u, 1.0)[None, :], n, axis=0)
    out = [tuple(H.grid_surface(rings, U, dist / vscale))]
    if caps[0]:
        out.append(H.cap(rings[0], -T[0]))
    if caps[1]:
        out.append(H.cap(rings[-1], T[-1]))
    return out


def capsule_profile(n, r):
    s = np.linspace(0, 1, n)
    return r * np.clip(1 - np.abs(2 * s - 1) ** 5, 0, 1) ** 0.5


def taper_profile(n, r, tip=0.0, power=1.4):
    """Rayon décroissant de r à tip (pointe fermée si tip=0)."""
    s = np.linspace(0, 1, n)
    return tip + (r - tip) * (1 - s) ** power


def line(a, b, n):
    return np.linspace(np.asarray(a, float), np.asarray(b, float), n)


def xf(parts, fn):
    return [(fn(P.copy()), UV, F) for P, UV, F in parts]


def rotz90(P):
    return np.stack([-P[:, 1], P[:, 0], P[:, 2]], -1)


def circle_path(c, R, n=40, plane="xy", a0=0.0, a1=2 * np.pi * 0.985):
    a = np.linspace(a0, a1, n)
    if plane == "xy":
        return np.stack([c[0] + R * np.cos(a), c[1] + R * np.sin(a), np.full(n, c[2])], -1)
    return np.stack([c[0] + R * np.cos(a), np.full(n, c[1]), c[2] + R * np.sin(a)], -1)


# ---------- lame à deux tranchants (losange à arête centrale) ----------
TOP = [(1.0, 0.0), (0.60, 0.55), (0.22, 0.95), (0.0, 1.0), (-0.22, 0.95), (-0.60, 0.55)]
PROFILE = np.array(TOP + [(-1.0, 0.0)] + [(x, -z) for x, z in reversed(TOP[1:])])


def double_blade(y0, L, wfun, tfun, cx=None, rows=(90, 34), tip_start=0.86):
    """Lame le long de +Y. wfun(t) largeur totale, tfun(t) demi-épaisseur, cx(t) déport latéral (courbe/ondulation)."""
    ts = np.concatenate([np.linspace(0, tip_start, rows[0], endpoint=False),
                         tip_start + (1 - tip_start) * (1 - (1 - np.linspace(0, 1, rows[1])) ** 1.6)])
    rings = []
    for t in ts:
        c = cx(t) if cx else 0.0
        d = ((cx(min(t + 1e-3, 1.0)) - cx(max(t - 1e-3, 0.0))) / (2e-3 * L)) if cx else 0.0
        nrm = np.array([1.0, -d, 0.0]) / np.hypot(1, d)
        hw, th = float(wfun(t)) / 2, float(tfun(t))
        ctr = np.array([c, y0 + L * t, 0.0])
        rings.append(ctr[None, :] + (PROFILE[:, 0] * hw)[:, None] * nrm[None, :] + (PROFILE[:, 1] * th)[:, None] * np.array([0, 0, 1.0])[None, :])
    rings = np.stack(rings)
    U, _ = H.ring_uv(rings)
    P, UV, F = H.grid_surface(rings, U, ts)
    return [(P, UV, F), H.cap(rings[0], (0, -1, 0))]


def leaf_width(wbase, wend, tip_start=0.80, bulge=0.0):
    def w(t):
        t = np.asarray(t, float)
        main = wbase + (wend - wbase) * sstep(0.0, tip_start, t) + bulge * np.sin(np.pi * np.clip(t / tip_start, 0, 1))
        s2 = np.clip((t - tip_start) / (1 - tip_start), 0, 1)
        return main * np.clip(1 - s2 ** 1.7, 0, 1) ** 0.55
    return w


def assemble(out_path, sets, report=True):
    """sets : {nom: (parts, crease, material)} -> GLB. Retourne la scène."""
    scene = trimesh.Scene()
    for name, (parts, crease, mat) in sets.items():
        acc = H.Acc()
        for P, UV, F in parts:
            acc.add(P, UV, F)
        scene.add_geometry(acc.build(crease, mat), node_name=name, geom_name=name)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(out_path, include_normals=True)
    if report:
        tris = sum(len(g.faces) for g in scene.geometry.values())
        b = scene.bounds
        print(f"OK : {tris} triangles -> {out_path.name} ({out_path.stat().st_size/1e6:.1f} Mo) dims", np.round(b[1] - b[0], 3),
              "y:", round(b[0][1], 3), "->", round(b[1][1], 3))
        bad = []
        for n, (parts, _, _) in sets.items():
            Ps, Fs, off = [], [], 0
            for P, UV, F in parts:
                Ps.append(P)
                Fs.append(F + off)
                off += len(P)
            m = trimesh.Trimesh(np.vstack(Ps), np.vstack(Fs), process=False)
            m.update_faces(m.area_faces > 1e-12)
            m.merge_vertices()
            _, c = np.unique(m.edges_sorted, axis=0, return_counts=True)
            if np.any(c == 1):          # arête libre = trou (les arêtes partagées par >2 faces viennent de pièces qui se touchent)
                bad.append(f"{n} ({int((c == 1).sum())} arêtes libres)")
        print("  sans trou :", "toutes les pièces" if not bad else "NON : " + ", ".join(bad))
    return scene
