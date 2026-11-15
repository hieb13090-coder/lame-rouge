# Bottes à réacteurs

Projet indépendant du jeu : modèle 3D de bottes noires chromées, avec réacteurs de semelle et de mollet (flammes vers le bas).
Ce dossier est autonome et n'a aucun lien avec le build du jeu (three.js 0.187 ici, 0.128 pour le jeu).

- `npm install` puis `npm run build` : produit `dist/index.html`, page interactive d'un seul fichier.
- `npm run export` : produit `dist/bottes_reacteurs.glb`, sans les flammes.
- `src/boots.js` construit les bottes, `src/main.js` gère la scène et les boutons.

À venir : plaque de mollet articulée qui se soulève à l'allumage des réacteurs, à partir d'un maillage généré depuis les images de référence.
