# Armes 3D haute définition (dossier `armes3d/`)

Générateurs Python des armes en 3D réaliste (GLB, PBR), aperçus et notes de design. **Rien ici n'est chargé par le jeu** : le jeu reste 100 % procédural dans `src/js/04_models.js`. Ce dossier est une base de modèles « vitrine » et de conception, à convertir pour l'intégration (voir la section « Intégration » en bas).

- `tools/` : un `gen_<arme>.py` par arme, `bake_weathering.py` (cuisson usure/AO/textures), `render_blender.py` (aperçus), `build_armory.py` (tous les GLB en un seul), `contact_sheet.py` (planche).
- `previews/` : aperçus JPEG (`planche_armes.jpg` = vue d'ensemble des 12 armes).
- Les GLB ne sont pas dans le dépôt (45 000 à 75 000 triangles et 7 à 11 Mo chacun). Pour les régénérer : `pip install numpy trimesh pillow scipy bpy`, puis `python3 tools/gen_<arme>.py build/raw` et `python3 tools/bake_weathering.py build/raw/<arme>_hd.glb assets/models/<arme>_hd.glb 2048 1.3` (~7 min par arme sur 2 cœurs).
- Les chemins des documents ci-dessous (`assets/models/...`, `previews/...`) sont ceux de l'espace de travail d'origine.

---

# Notes de design : jeu de combat contre des samouraïs

## Armes déjà faites
| Arme | Fichier | Variante | Gravure (alphabet Sigil) |
|---|---|---|---|
| Épée longue « Aurore » v2 (réaliste, pilote AAA) | `assets/models/sword_epic_hd.glb` | acier, sans élément | AURORE gravé (non lumineux) dans la gouttière |
| Épée de chevalier (low-poly, LOD) | `assets/models/sword_epic.glb` | acier | runes décoratives |
| Katana « Yugiri » (réaliste, d'après photo de référence) | `assets/models/katana_hd.glb` + fourreau `assets/models/katana_saya_hd.glb` (même repère : le fourreau s'emboîte sur la lame) | base | tresse noire sur samegawa blanc, tsuba ronde noire, habaki doré, lame polie claire sans gouttière ni inscription ; saya laque noire, koiguchi/kojiri en corne, kurikata, sageo noir |
| Gantelets de super-guerrier « Poings-Wyrm » (corps à corps) | `assets/models/dragon_gauntlet_R_hd.glb`, `dragon_gauntlet_L_hd.glb` | base (v3) | poing fermé énorme entièrement blindé : phalanges en acier sombre, grosse barre de jointures dorée, dos de main en lames d'écailles de dragon cramoisies, brassard à 4 lames cerclées d'or, 2 vérins latéraux à bagues lumineuses braise, panneau d'écailles avec fente lumineuse, crête d'épines ; ~0,84 m. Cornes de jointures et griffe de pouce codées mais désactivées (`HORNS`, `CLAW`) |
| Marteau « Brise-Monts » (sans foudre) | `assets/models/hammer_hd.glb` | base | fer martelé, bande tressée, cuivre, cuir brun |
| Épée volante « Plume » | `assets/models/flying_sword_hd.glb` | base (filet lumineux blanc chaud) | acier miroir, ailes champagne, gland de soie |
| Dague « Vipère » | `assets/models/dagger_hd.glb` | base | lame ondulée damassée, manche d'ébène, laiton |
| Couteau de lancer « Éclat » | `assets/models/throwing_knife_hd.glb` | base | acier noirci, cordage olive, anneau |
| Naginata « Tsukikage » | `assets/models/naginata_hd.glb` | base, sans élément (inscription blanc chaud neutre) | TSUKIKAGE |
| Épée de feu « Brasier » (flamberge) | `assets/models/sword_fire_hd.glb` | feu, lave émissive dans les fissures et la gouttière | BRASIER |
| Claymore « Tempête » | `assets/models/claymore_hd.glb` | acier, quillons inclinés vers la lame, écussons et boutons dorés | TEMPETE |
| Bô « Gardien » (bâton, 1,80 m) | `assets/models/bo_hd.glb` | chêne patiné, 2 prises en cordon, bagues de laiton, embouts d'acier gravés | aucune |
| Hache barbue « Fendeur » (~1,04 m) | `assets/models/axe_hd.glb` | frêne, tête à filets de cuivre et gravure en losanges, douille rivetée, pic arrière | aucune |

Générateurs : `tools/gen_katana.py`, `tools/gen_dragon_gauntlets.py` (poing vers +Z, dos de main +Y), `tools/gen_hammer.py`, `tools/gen_flying_sword.py`, `tools/gen_dagger.py`, `tools/gen_throwing_knife.py`, `tools/gen_naginata.py <dossier> [TEXTE]` (naginata, origine = main avant, 2,27 m), `tools/gen_flamberge.py` (épée de feu), `tools/gen_claymore.py`, `tools/gen_bo.py`, `tools/gen_axe.py`, `tools/build_armory.py` (assemble tous les GLB en un seul `armurerie.glb`), `tools/gen_sword_hd.py <dossier> [steel|fire] [TEXTE]`, rendu `tools/render_blender.py`, alphabet `tools/sword_alphabet.py`.

## Idée notée : variantes élémentaires (à trancher plus tard)
- Variante de base : **soit foudre, soit sans élément**.
- Variante **foudre** : même principe que la version feu, version foudre (lame métallique, arcs électriques, texte lumineux).
- **Attention aux confusions** si un style **eau** existe un jour : le bleu/cyan est partagé entre eau et foudre.
  - Foudre : blanc, jaune électrique, violet ; arcs en zigzag nerveux ; lueur saccadée.
  - Eau (si créée) : turquoise/bleu profond, surfaces fluides, gouttes ; lueur douce et continue.
  - Point ouvert : la version acier actuelle a des glyphes cyan, proches d'un style eau. À rendre neutre (blanc doux) si l'eau est retenue.

## État au 12 nov. 2026 (passation)
- Toutes les armes ci-dessus sont des **versions de base** : chacune a sa propre identité visuelle (matériaux et palette différents) ; l'utilisateur donnera ensuite les retouches arme par arme.
- Gants rejetés successivement : cuir « Yoru », gantelets v1 (poing trop petit), v2 (trop « gant de boxe »). v3 = gantelets mécaniques de super-guerrier, sans style boxe. Idée gardée pour plus tard : cornes de dragon sur les jointures.
- Marteau « Brise-Monts » rendu plus métallique (acier poli aux arêtes, rugosité 0,26) car il paraissait en carton.
- Prévu : l'utilisateur continue avec le modèle Fable 5.2 (changement côté application) ; tout l'état est ici.
- Reste à faire / idées : fourreau du katana, variante yari, variantes élémentaires (foudre, feu, eau), tanegashima/arc (fumée), nom du dépôt GitHub, moteur à identifier, test d'import GLB.

## Outils
- `tools/kit.py` : balayage de tubes (`sweep`), lame à deux tranchants (`double_blade`), assemblage + contrôle des trous (`assemble`).
- Générateurs : un `gen_<arme>.py` par arme, commande `python3 tools/gen_<arme>.py assets/models`.
- Rendus : `tools/render_blender.py` (variables ORTHO, TILT, PIVOT, DETAIL_Z, DCAM, BLADE_Z).

## Reste à décider
- Armes à poudre/arc : tanegashima et yumi restent possibles (lien avec la fumée).
- Variante yari (lance droite) du naginata : même générateur, lame droite à section losange.
- Fumée par arme (particules dans le moteur) : à prototyper quand le moteur est connu.
- Moteur et nom du dépôt GitHub.

## Personnage de test « Ronin » (pour brancher les effets)
- Fichier : `assets/models/ronin_character.glb` (générateur `tools/gen_character.py <dossier_glb> [dossier_previews]`, Blender sans écran).
- 1,80 m, ~24k triangles, un seul maillage skinné, 8 matériaux (tissu, bandes, peau, laque rouge, acier, or, cheveux, ceinture).
- Repère : Y en haut, mètres, regarde vers +Z, origine au sol entre les pieds. Pose de repos en A.
- Squelette (20 os) : Root, Hips, Spine, Chest, Neck, Head, Shoulder/UpperArm/LowerArm/Hand _L/_R, Thigh/Shin/Foot _L/_R.
- Animations : `Idle` (garde + respiration, 60 images à 30 i/s, boucle) et `Punch_R` (direct du droit, 24 images, impact image 9-13).
- Points d'accroche (nœuds vides suivant les os) : `FX_Hand_R/L` (poings), `FX_Weapon_R/L` (prise d'arme), `FX_Chest`, `FX_Head`, `FX_Foot_R/L`, `FX_Aura` (au sol).
- Usage prévu : y attacher les particules (fumée par arme, auras élémentaires, traînées d'impact) et les armes, puis remplacer par le vrai personnage en gardant les mêmes noms d'os et de points FX.

## Passe « réalisme AAA » (nov. 2026)
- Demande : toutes les armes au niveau d'un Elden Ring (détails nets, matériaux crédibles). Pilote fait sur l'épée longue « Aurore ».
- Générateur réaliste : `tools/gen_longsword.py build/raw` (section de lame réelle : méplats bombés, biseaux de fil, gouttière, talon forgé, pointe en ogive ; garde à quillons recourbés et boutons, écusson losange ; poignée cuir à 2 renforts et bagues de fil torsadé ; pommeau en roue).
- Textures partagées : `tools/forge_tex.py` (acier noirci, or vieilli, cuir de poignée).
- Cuisson : `tools/bake_weathering.py build/raw/X.glb assets/models/X.glb 2048 1.3` → occlusion ambiante, usure claire des arêtes métal, crasse dans les creux, chanfreins cuits dans la normal map ; sortie 1 matériau, UV uniques, textures 2048. ~8 min par arme sur ce serveur (2 cœurs).
- Les GLB bruts (avant cuisson) vont dans `build/raw/` ; les GLB finaux dans `assets/models/`.
- Faits (passe réalisme) : épée longue, katana (+ fourreau), naginata, marteau, dague, couteau de lancer, épée volante, épée de feu, gantelets, claymore, bô, hache.
- Poids : 45 000 à 75 000 triangles et 7 à 11 Mo par arme (texture 2048). C'est du matériel « vitrine », pas du matériel de jeu mobile : voir « Intégration » ci-dessous.
- Règle lames japonaises (corrigée le 13 nov.) : le tranchant (+X) est du côté BOMBÉ, la lame se courbe vers le dos (curve_x négatif) ; la pointe garde le dos continu et c'est le tranchant qui remonte (décalage `bw_main` dans `blade_ring`). Le katana suit la photo de référence de l'utilisateur (lame lisse à une arête, sans gouttière ni inscription, courbure 4,8 cm).

### Katana : règles de forme validées sur la photo de référence (13 nov.)
- Courbure vers le dos (mune), tranchant du côté bombé ; flèche 1,9 % de la longueur de lame (~1,4 cm), mesurée sur la photo.
- La poignée prolonge la même courbure (~3-4° à la kashira).
- Pointe (kissaki) : le dos reste continu jusqu'à la pointe, c'est le tranchant qui remonte (fukura) ; longueur ~1,5 × la largeur.
- Proportions de la photo : lame et monture ×1,3 en largeur ; tresse noire épaisse avec une rangée de ~11 losanges blancs par face.
- Contrôle : rendu dans la pose de la photo (PIVOT=180,33,0) + image `previews/katana_vs_reference.png`.
- Naginata : même règle de sens de courbe et de pointe.

## Intégration dans Lame Rouge (dépôt hieb13090-coder/lame-rouge, 14 nov.)
- Le jeu est en **three.js r128, dans le navigateur, mobile compris**, 100 % procédural : aucune image, aucun glTF, une seule page HTML. Armes actuelles : `Models.weaponGeo(id)` dans `src/js/04_models.js` (boîtes et cylindres fusionnés, couleurs par sommet), convention : origine dans la main, +Y vers la pointe, tranchant vers +Z.
- Les GLB de cette passe ne sont **pas utilisables tels quels en jeu** : triangles ×20 à ×100 par rapport aux armes du jeu, textures 2048, tranchant vers +X, un `GLTFLoader` à ajouter, et la règle du dépôt « préférer le procédural » (les fichiers ne marchent pas dans la page Claude).
- Pistes : (A) GLB « vitrine » pour menu, aperçu d'arme et trailer ; (B) version LOD ≤ 3 000 triangles, texture 512, repère du jeu, chargée au démarrage sur le site ; (C) traduction en code three.js procédural (le plus cohérent avec le dépôt, le plus long).
- Doublons avec le jeu : claymore, bâton, hache (hatchet/daneaxe), katana, épée de chevalier existent déjà en low-poly ; dague, couteau de lancer, épée volante, épée de feu, gantelets, marteau, naginata sont nouveaux.
