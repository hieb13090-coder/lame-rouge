"""Épée épique low-poly (design original) -> GLB.

Repère glTF : Y haut, lame vers +Y, origine = centre de la poignée (là où la main tient l'arme).
Unités : mètres. Longueur totale ~1,35 m.

Usage : python3 gen_sword_epic.py <dossier_sortie>
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_sword import loft, flat  # noqa: E402

GRIP_CENTER_Y = -0.151  # recalé sur l'origine en fin de build


def ring_ellipse(y, rx, rz, n=8, rot=np.pi / 8):
    return [(rx * np.cos(2 * np.pi * i / n + rot), y, rz * np.sin(2 * np.pi * i / n + rot)) for i in range(n)]


# ---------- lame : section à gouttière centrale (14 points) ----------

def blade_section(y, w, t, g):
    h = w / 2
    top = [(-h, 0), (-0.72 * h, t), (-0.40 * h, t), (-0.30 * h, t - g),
           (0.30 * h, t - g), (0.40 * h, t), (0.72 * h, t), (h, 0)]
    bot = [(0.72 * h, -t), (0.40 * h, -t), (0.30 * h, -(t - g)),
           (-0.30 * h, -(t - g)), (-0.40 * h, -t), (-0.72 * h, -t)]
    return [(x, y, z) for x, z in top + bot]


BLADE_STATIONS = [  # y, largeur, demi-épaisseur, profondeur de gouttière
    (0.00, 0.070, 0.0058, 0.0),
    (0.12, 0.070, 0.0058, 0.0),      # fin du talon (ricasso)
    (0.16, 0.069, 0.0058, 0.0022),   # début de gouttière
    (0.60, 0.060, 0.0050, 0.0020),
    (0.68, 0.057, 0.0048, 0.0),      # fin de gouttière
    (0.80, 0.050, 0.0042, 0.0),
    (0.90, 0.040, 0.0034, 0.0),
    (0.96, 0.028, 0.0026, 0.0),
]
BLADE_TIP = (0.0, 1.02, 0.0)


def blade():
    return loft([blade_section(*s) for s in BLADE_STATIONS], cap_start=True, apex=BLADE_TIP)


def groove_bottom_z(y):
    """Hauteur (z) du fond de gouttière à l'abscisse y, pour poser les runes dessus."""
    t = 0.0058 - 0.0008 * (y - 0.16) / 0.44
    g = 0.0022 - 0.0002 * (y - 0.16) / 0.44
    return t - g


# ---------- runes lumineuses (inserts émissifs dans la gouttière) ----------

GLYPHS = [
    [((0, -0.016), (0, 0.016)), ((0, 0.016), (0.008, 0.008)), ((0, 0.004), (0.008, -0.004))],
    [((0, -0.016), (0, 0.016)), ((-0.007, 0.010), (0.007, -0.002))],
    [((-0.007, 0.016), (0, -0.016)), ((0, -0.016), (0.007, 0.016))],
    [((0, 0.016), (0.008, 0.0)), ((0.008, 0.0), (0, -0.016))],
    [((-0.006, 0.016), (0.006, 0.004)), ((0.006, 0.004), (-0.006, -0.004)), ((-0.006, -0.004), (0.006, -0.016))],
]
RUNE_Y = [0.22, 0.29, 0.36, 0.43, 0.50]


def runes():
    boxes = []
    for y0, glyph in zip(RUNE_Y, GLYPHS):
        zb = groove_bottom_z(y0)
        for side in (1, -1):
            for (ax, ay), (bx, by) in glyph:
                dx, dy = bx - ax, by - ay
                length = float(np.hypot(dx, dy)) + 0.0015
                ang = float(np.arctan2(dy, dx))
                T = trimesh.transformations.rotation_matrix(ang, [0, 0, 1])
                T[:3, 3] = [(ax + bx) / 2, y0 + (ay + by) / 2, side * (zb + 0.0003)]
                b = trimesh.creation.box(extents=(length, 0.0032, 0.0012), transform=T)
                boxes.append(flat(b, fix=False))
    return trimesh.util.concatenate(boxes)


# ---------- garde : bloc central + quillons torsadés ----------

def guard_boss():
    stations = [(-0.040, 0.62), (-0.022, 1.0), (0.030, 1.0), (0.055, 0.70)]
    return loft([ring_ellipse(y, 0.036 * k, 0.024 * k) for y, k in stations], cap_start=True, cap_end=True)


def guard_arm(sign, segments=14, turns=1.5):
    secs = []
    for k in range(segments + 1):
        s = k / segments
        x = sign * (0.03 + 0.16 * s)
        h = 0.0115 * (1 - 0.30 * s)
        th = s * 2 * np.pi * turns + np.pi / 4
        yoff = 0.032 * s * s
        secs.append([(x, yoff + h * np.cos(th + q * np.pi / 2), h * np.sin(th + q * np.pi / 2)) for q in range(4)])
    return loft(secs, cap_start=True, apex=(sign * 0.222, 0.034, 0.0))


# ---------- poignée cordée, bagues, pommeau ----------

def grip():
    n = 12
    secs = []
    for i in range(n):
        s = i / (n - 1)
        y = -0.040 - 0.222 * s
        r = 0.0145 + 0.0016 * np.sin(np.pi * s)
        secs.append(ring_ellipse(y, r, r, 8, rot=i * 0.38))
    return loft(secs)


def band(y0, y1, r=0.0195):
    return loft([ring_ellipse(y0, r, r), ring_ellipse(y1, r, r)])


def pommel():
    stations = [(-0.262, 0.0165), (-0.270, 0.0165), (-0.278, 0.034), (-0.292, 0.042), (-0.306, 0.036), (-0.318, 0.020)]
    return loft([ring_ellipse(y, r, r, 10, rot=np.pi / 10) for y, r in stations], cap_start=True, apex=(0, -0.328, 0))


# ---------- matériaux ----------

MAT = {
    "Blade": PBRMaterial(name="steel", baseColorFactor=[0.80, 0.82, 0.86, 1.0], metallicFactor=1.0, roughnessFactor=0.28),
    "Guard": PBRMaterial(name="dark_iron", baseColorFactor=[0.22, 0.23, 0.26, 1.0], metallicFactor=0.9, roughnessFactor=0.55),
    "Fittings": PBRMaterial(name="dark_iron", baseColorFactor=[0.22, 0.23, 0.26, 1.0], metallicFactor=0.9, roughnessFactor=0.55),
    "Pommel": PBRMaterial(name="dark_iron", baseColorFactor=[0.22, 0.23, 0.26, 1.0], metallicFactor=0.9, roughnessFactor=0.55),
    "Grip": PBRMaterial(name="leather", baseColorFactor=[0.30, 0.09, 0.05, 1.0], metallicFactor=0.0, roughnessFactor=0.85),
    "Runes": PBRMaterial(name="rune_glow", baseColorFactor=[0.10, 0.50, 0.90, 1.0], metallicFactor=0.0, roughnessFactor=0.4,
                         emissiveFactor=[0.25, 0.75, 1.0]),
}


def build():
    parts = {
        "Blade": [flat(blade())],
        "Guard": [flat(guard_boss()), flat(guard_arm(+1)), flat(guard_arm(-1))],
        "Grip": [flat(grip())],
        "Fittings": [flat(band(-0.040, -0.054)), flat(band(-0.248, -0.262))],
        "Pommel": [flat(pommel())],
        "Runes": [runes()],
    }
    scene = trimesh.Scene()
    stats = {}
    for name, meshes in parts.items():
        m = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
        m.apply_translation([0, -GRIP_CENTER_Y, 0])  # origine = centre de la poignée
        m.visual = trimesh.visual.TextureVisuals(material=MAT[name])
        scene.add_geometry(m, node_name=name, geom_name=name)
        stats[name] = [trimesh.Trimesh(x.vertices, x.faces, process=True) for x in meshes]
    return scene, stats


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    scene, _ = build()
    scene.export(out / "sword_epic.glb")
    tris = sum(len(g.faces) for g in scene.geometry.values())
    print(f"OK : {tris} triangles, {len(scene.geometry)} pièces -> {out / 'sword_epic.glb'}")
