"""Rendu d'aperçu (3 vues) d'un GLB low-poly avec ombrage facetté. Usage : python3 render_preview.py in.glb out.png"""
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

scene = trimesh.load(sys.argv[1])
light = np.array([0.4, 0.7, 0.6]); light /= np.linalg.norm(light)

fig = plt.figure(figsize=(15, 11), facecolor="#1b1e24")
# azim=-90 : on regarde l'épée de face (plat de la lame vers nous) ; azim=0 : de profil (tranchant)
views = [("Face (plat de la lame)", 0, -90), ("Profil (tranchant)", 0, 0), ("3/4", 18, -55)]
for k, (title, elev, azim) in enumerate(views):
    ax = fig.add_subplot(1, 3, k + 1, projection="3d", facecolor="#1b1e24")
    for name, g in scene.geometry.items():
        mat = g.visual.material
        base = np.array(mat.baseColorFactor[:3], dtype=float) / (255.0 if max(mat.baseColorFactor[:3]) > 1 else 1.0)
        tris = g.vertices[g.faces]
        n = g.face_normals[:, [0, 2, 1]]
        a, e = np.radians(azim), np.radians(elev)
        cam = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
        right = np.array([-np.sin(a), np.cos(a), 0.0])
        lt = cam + 0.5 * right + 0.6 * np.array([0, 0, 1.0]); lt /= np.linalg.norm(lt)
        shade = 0.30 + 0.70 * np.clip(n @ lt, 0, 1)
        cols = np.clip(base[None, :] * shade[:, None], 0, 1)
        # axes matplotlib : Z vers le haut => on mappe (x, z, y)
        t = tris[:, :, [0, 2, 1]]
        pc = Poly3DCollection(t, facecolors=cols, edgecolors=(0, 0, 0, 0.25), linewidths=0.4)
        ax.add_collection3d(pc)
    ax.set_xlim(-0.14, 0.14); ax.set_ylim(-0.14, 0.14); ax.set_zlim(-0.22, 0.85)
    ax.set_proj_type("ortho")
    ax.set_box_aspect((0.28, 0.28, 1.07), zoom=1.0)
    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    ax.set_title(title, color="#c9ced6", fontsize=14)
plt.tight_layout()
plt.savefig(sys.argv[2], dpi=110, facecolor=fig.get_facecolor())
print("rendu ->", sys.argv[2])
