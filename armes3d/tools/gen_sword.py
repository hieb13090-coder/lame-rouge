"""Génère une épée de chevalier low-poly (GLB + OBJ).

Repère : Y vers le haut (glTF), lame le long de +Y, origine = centre de la garde.
Unités : mètres. Aucune dépendance autre que numpy + trimesh.

Usage : python3 gen_sword.py <dossier_sortie>
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial


# ---------- outils de maillage ----------

def loft(sections, cap_start=True, cap_end=True, apex=None):
    """Relie des anneaux de N points 3D (même N partout) en un solide fermé.

    apex : point 3D optionnel. Si fourni, le dernier anneau est relié à ce
    sommet unique par un éventail de triangles (pointe de lame, pommeau) :
    aucun triangle dégénéré, maillage fermé.
    """
    sections = [np.asarray(s, dtype=float) for s in sections]
    n = len(sections[0])
    verts = np.vstack(sections)
    faces = []
    for k in range(len(sections) - 1):
        a, b = k * n, (k + 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([a + i, a + j, b + j])
            faces.append([a + i, b + j, b + i])
    if apex is not None:
        c = len(verts)
        verts = np.vstack([verts, np.asarray(apex, dtype=float)])
        base = (len(sections) - 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([base + i, base + j, c])
        cap_end = False
    for flag, ring_idx, flip in ((cap_start, 0, True), (cap_end, len(sections) - 1, False)):
        if not flag:
            continue
        c = len(verts)
        verts = np.vstack([verts, sections[ring_idx].mean(axis=0)])
        base = ring_idx * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([c, base + j, base + i] if flip else [c, base + i, base + j])
    return trimesh.Trimesh(verts, np.array(faces), process=False)


def flat(mesh, fix=True):
    """Orientation cohérente + sommets dupliqués par face => ombrage facetté low-poly."""
    mesh = trimesh.Trimesh(mesh.vertices, mesh.faces, process=True)
    if fix:
        trimesh.repair.fix_normals(mesh)
    v = mesh.vertices[mesh.faces].reshape(-1, 3)
    f = np.arange(len(v)).reshape(-1, 3)
    return trimesh.Trimesh(v, f, process=False)


def ring_xz(cx, y, pts):
    return [(cx + x, y, z) for x, z in pts]


def ring_round(y, r, n=8, rot=np.pi / 8):
    return [(r * np.cos(2 * np.pi * i / n + rot), y, r * np.sin(2 * np.pi * i / n + rot)) for i in range(n)]


# ---------- pièces ----------

def blade():
    # section hexagonale : tranchants à gauche/droite, dos plat au centre
    def sec(y, w, t, flat_ratio=0.22):
        return ring_xz(0, y, [(-w / 2, 0), (-w * flat_ratio, t), (w * flat_ratio, t),
                              (w / 2, 0), (w * flat_ratio, -t), (-w * flat_ratio, -t)])
    s = [sec(0.00, 0.050, 0.0065),
         sec(0.10, 0.049, 0.0062),
         sec(0.50, 0.040, 0.0050),
         sec(0.68, 0.030, 0.0038),
         sec(0.76, 0.018, 0.0024)]
    return loft(s, cap_start=True, apex=(0, 0.83, 0))


def guard():
    # barre le long de X, section rectangulaire, bouts effilés et recourbés vers le bas
    def sec(x, h, d, dy=0.0):
        return [(x, dy + h / 2, d / 2), (x, dy + h / 2, -d / 2),
                (x, dy - h / 2, -d / 2), (x, dy - h / 2, d / 2)]
    xs = [(-0.115, 0.014, 0.014, -0.018), (-0.085, 0.020, 0.020, -0.010),
          (-0.045, 0.028, 0.028, 0.000), (-0.022, 0.034, 0.034, 0.000),
          (0.022, 0.034, 0.034, 0.000), (0.045, 0.028, 0.028, 0.000),
          (0.085, 0.020, 0.020, -0.010), (0.115, 0.014, 0.014, -0.018)]
    return loft([sec(*a) for a in xs])


def grip():
    stations = [(-0.012, 0.0140), (-0.045, 0.0165), (-0.095, 0.0165), (-0.150, 0.0140)]
    return loft([ring_round(y, r) for y, r in stations])


def pommel():
    stations = [(-0.150, 0.011), (-0.162, 0.024), (-0.178, 0.026), (-0.196, 0.016)]
    return loft([ring_round(y, r) for y, r in stations], cap_start=True, apex=(0, -0.206, 0))


MATERIALS = {
    "Blade": PBRMaterial(name="steel", baseColorFactor=[0.78, 0.80, 0.84, 1.0], metallicFactor=0.9, roughnessFactor=0.35),
    "Guard": PBRMaterial(name="brass", baseColorFactor=[0.72, 0.55, 0.20, 1.0], metallicFactor=0.85, roughnessFactor=0.45),
    "Grip": PBRMaterial(name="leather", baseColorFactor=[0.25, 0.14, 0.08, 1.0], metallicFactor=0.0, roughnessFactor=0.9),
    "Pommel": PBRMaterial(name="brass", baseColorFactor=[0.72, 0.55, 0.20, 1.0], metallicFactor=0.85, roughnessFactor=0.45),
}


def build():
    parts = {"Blade": blade(), "Guard": guard(), "Grip": grip(), "Pommel": pommel()}
    scene = trimesh.Scene()
    for name, m in parts.items():
        m = flat(m)
        m.visual = trimesh.visual.TextureVisuals(material=MATERIALS[name])
        scene.add_geometry(m, node_name=name, geom_name=name)
    return scene


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    scene = build()
    scene.export(out / "sword_knight.glb")
    scene.export(out / "sword_knight.obj")
    tris = sum(len(g.faces) for g in scene.geometry.values())
    print(f"OK : {tris} triangles, {len(scene.geometry)} pièces -> {out}")
