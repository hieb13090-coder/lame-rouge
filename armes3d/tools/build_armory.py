"""Assemble toutes les armes dans un seul GLB « armurerie » (rangées sur un râtelier virtuel, debout, alignées sur X).
Usage : python3 build_armory.py [dossier_modèles] [sortie.glb] [taille_max_texture]
Les noeuds portent le nom de l'arme ; chaque arme garde son repère propre (origine = prise) dans un noeud parent translaté."""
import sys
from pathlib import Path

import numpy as np
import trimesh

MODELS = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/models")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else MODELS / "armurerie.glb")
TEXMAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024

ORDER = [("katana_hd", "Katana"), ("katana_saya_hd", "Katana_Saya"), ("sword_epic_hd", "Epee_Aurore"), ("claymore_hd", "Claymore_Tempete"),
         ("sword_fire_hd", "Epee_Brasier"), ("flying_sword_hd", "Epee_Volante_Plume"), ("dagger_hd", "Dague_Vipere"),
         ("throwing_knife_hd", "Couteau_Eclat"), ("hammer_hd", "Marteau_BriseMonts"), ("axe_hd", "Hache_Fendeur"),
         ("naginata_hd", "Naginata"), ("bo_hd", "Bo_Gardien"), ("dragon_gauntlet_R_hd", "Gantelet_Dragon_D"),
         ("dragon_gauntlet_L_hd", "Gantelet_Dragon_G")]


def shrink(scene, tmax):
    for g in scene.geometry.values():
        m = getattr(g.visual, "material", None)
        for attr in ("baseColorTexture", "metallicRoughnessTexture", "normalTexture", "emissiveTexture", "occlusionTexture"):
            im = getattr(m, attr, None)
            if im is not None and max(im.size) > tmax:
                k = tmax / max(im.size)
                setattr(m, attr, im.resize((max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k)))))


def main():
    out = trimesh.Scene()
    x = 0.0
    table = []
    for stem, name in ORDER:
        f = MODELS / f"{stem}.glb"
        if not f.exists():
            continue
        sc = trimesh.load(f)
        shrink(sc, TEXMAX)
        lo, hi = sc.bounds
        # debout : la plus grande dimension le long de Y (déjà le cas) ; posé sur y=0
        w = max(hi[0] - lo[0], hi[2] - lo[2], 0.12)
        cx = (lo[0] + hi[0]) / 2
        T = trimesh.transformations.translation_matrix([x + w / 2 - cx, -lo[1], 0.0])
        for gname, g in sc.geometry.items():
            out.add_geometry(g.copy(), node_name=f"{name}__{gname}", geom_name=f"{name}__{gname}", transform=T)
        table.append((name, stem, float(hi[1] - lo[1]), sum(len(g.faces) for g in sc.geometry.values())))
        x += w + 0.25
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.export(OUT)
    print(f"OK : {len(table)} armes -> {OUT} ({OUT.stat().st_size / 1e6:.0f} Mo)")
    for n, s, h, t in table:
        print(f"  {n:22s} {s:24s} {h:5.2f} m  {t:6d} tris")


if __name__ == "__main__":
    main()
