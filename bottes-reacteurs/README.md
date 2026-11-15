# Bottes à réacteurs

Projet indépendant du jeu : modèle 3D de bottes noires chromées, avec réacteurs de semelle et de mollet (flammes vers le bas) et une plaque de tibia articulée qui se soulève à l'allumage.
Ce dossier est autonome (three.js 0.187 ici, 0.128 pour le jeu). Le code de géométrie n'utilise que des API présentes dans la r128, pour pouvoir être porté dans `04_models.js`.

- `npm install`, puis `npm run build` : produit `dist/index.html`, page interactive d'un seul fichier.
- `npm run export` : produit `dist/bottes_reacteurs.glb` (sans les flammes) avec l'animation `plaque_ouvre`.
- `src/ref.js` : mesures de la fiche de référence (silhouettes de face et de côté, contour vert de la plaque). Régénérées par `outils/mesurer_fiche.py`.
- `src/boots.js` : fût et pied en sections elliptiques mesurées, réacteurs, plaque de montage à 4 vis, plaque articulée.

## Intégration prévue dans le jeu
Le jeu construit une géométrie fusionnée par segment, avec couleurs par sommet : `G.shin` pour le tibia et `G.foot` pour le pied (voir `04_models.js`). Les bottes deviendraient ces deux géométries, et la plaque un mesh enfant du tibia avec pivot. Les touches utilisent des capsules : le gameplay ne change pas. À faire après accord d'Iheb et de son associé graphique.

## Jambière creuse (Blender, `bpy`)

`blender/` contient la version « armure » : coque creuse qui accueille une jambe et un pied (1 u = 4,6 cm), réacteur arrière sur la hauteur du mollet (3 conduits) caché sous une plaque articulée.
- `python3 -I blender/export.py dist/jambiere_reacteur.glb` : modèle + animations (plaque, buses, flammes).
- `python3 -I blender/render.py <rear|rear34|cut|cut_open|front34> sortie.png` : rendus Cycles.
- La coque est ajustée à une jambe de contrôle (test de contenance : 0 sommet hors cavité). La pointe du pied est allongée de ~2,5 u par rapport à la fiche pour loger un pied de 26 cm.
