# Lame Rouge : guide pour Claude

Ce fichier donne tout le contexte du projet à l'assistant qui travaille sur ce dépôt. À lire en entier avant de modifier quoi que ce soit.

## Le projet en bref

- Jeu de combat de samouraïs en 3D dans le navigateur. Démembrement, sang, armures qui cassent, lames élémentaires.
- Modes : donjon par vagues (avec boss et progression), bac à sable, tutoriel, duel 1v1 en ligne.
- Propriétaire : Iheb, compte GitHub `hieb13090-coder`. Son associé reprend la **partie graphique**.
- Site public (GitHub Pages, branche `main`, fichier `index.html`) : https://hieb13090-coder.github.io/lame-rouge/
- Il existe aussi une copie publiée comme page Claude (« artefact ») sur le compte d'Iheb. Seul Iheb peut la mettre à jour, depuis sa propre conversation Claude, à partir de `dist/lame-rouge.html`.
- L'équipe parle français. Réponses, commentaires de code et textes du jeu en **français**.

## Règles de travail

- **Tout push sur `main` met le site à jour pour tous les joueurs** en une minute environ. Vérifier avant de pousser.
- Toujours `npm run build` avant de committer, et committer le nouvel `index.html` avec les sources. Ne jamais éditer `index.html` à la main.
- Pour un travail en cours, utiliser une branche et une pull request.
- Iheb veut que **chaque avancée validée soit poussée sur GitHub** (sur `main`, donc en ligne), une fois les tests passés. Les invitations et autres actions visibles restent soumises à son accord.

## Construction

- `npm install` installe three.js **0.128.0**, version figée. L'API r128 compte : pas d'imports ES modules, `THREE` est global.
- `node build.js` (ou `npm run build`) assemble `src/head.html` puis tous les `src/js/*.js` **dans l'ordre alphabétique**. Le code est enveloppé dans une IIFE `'use strict'` à l'intérieur d'une seule balise `<script>`. Toutes les constantes de premier niveau sont partagées entre fichiers.
- Le build produit :
  - `index.html` : le site. Fichier unique, three.js inclus, jouable hors connexion.
  - `dist/Lame-Rouge-jeu.html` : la même chose.
  - `dist/lame-rouge.html` : la version pour la page Claude. three.js vient du CDN cdnjs, sans document complet autour.
  - `test/index.html` : la version de développement, qui charge `../node_modules/three`.
- Contraintes de la page Claude :
  - scripts externes seulement depuis cdnjs, jsdelivr ou unpkg, avec une version exacte ;
  - polices seulement depuis Google Fonts ;
  - tout le reste en ligne ;
  - pas de WebRTC dans cette page.
- Si on ajoute un jour des fichiers (images, glTF…), ils ne marcheront que sur le site, pas sur la page Claude. Préférer le procédural.

## Architecture (src/js)

| Fichier | Objets principaux | Rôle |
|---|---|---|
| `00_core.js` | `CFG`, `WEAPONS`, `WEAPON_ORDER`, `ELEMENTS`, `ARENAS`, `ARMORS`, `TYPES`, `Save`, `Input`, `KeyName` | Maths, données, sauvegarde (localStorage), clavier, souris, tactile |
| `01_audio.js` | `Sfx` | Sons synthétisés en Web Audio, aucun fichier |
| `02_gfx.js` | `Gfx`, `PALETTES`, `Env`, `Fx`, `Trails`, `Blood`, `Drops`, `Clip` | Moteur de rendu, lumières par arène, construction des arènes, particules, sang, traînées |
| `02b_textures.js` | `Tex` | Textures procédurales des arènes (dalles, sable, muraille, planches, terre brûlée) : couleur, relief et rugosité en une passe |
| `03_physics.js` | `Phys` | Verlet : ragdolls, membres tranchés, armes au sol |
| `04_models.js` | `D`, `SEGS`, `Models` | Modèles procéduraux des combattants et des armes, plaies et os |
| `05_fighter.js` | `Fighter`, `POSE` | Squelette, marche avec pieds posés (IK des jambes), bras, dash, animation |
| `05b_wounds.js` | méthodes de `Fighter` | Blessures (entaille, plaie, tranché), moignons, hémorragie |
| `06_combat.js` | `Combat`, `KV` | Coups (arc réel de la lame testé contre chaque membre), garde, parade, coups de pied |
| `07_ai_player.js` | `AI`, `COMBOS`, `Player` | IA ennemie, commandes du joueur, caméra, verrouillage par membre |
| `08_armor_water.js` | `Water` + méthodes de `Fighter` | Armures (modèles, casse), pouvoir Eau, projection et mise à terre |
| `08b_extras.js` | `Crows`, `Kunai` | Corbeaux, kunai, bourrade |
| `08c_powers.js` | `Soul`, `Powers`, `POWERS` | Parade parfaite, armes arrachées, pouvoirs feu, glace, foudre |
| `08d_tuto.js` | `Tuto` | Tutoriel |
| `08e_net.js` | `NetLink`, `Net` | Duel 1v1 en ligne |
| `09_game.js` | `HUD`, `Game`, `ATTRS` | Modes, vagues, progression, interface, boucle principale |

`src/head.html` contient tout le HTML (menus, panneaux, HUD, commandes tactiles) et le CSS. Les couleurs de l'interface sont des variables `:root` : `--beni`, `--washi`, `--sumi`, `--ai`, `--kincha`, `--koori`, `--matcha`, `--rai`, `--hi`. Les tailles de texte : `--t-xs` à `--t-xl`. Les polices : `--f-display` (Shippori Mincho B1) et `--f-ui` (Zen Kaku Gothic New).

## Partie graphique : ce qu'il faut savoir

### Personnages

- `Models.fighter(typeId)` construit **une géométrie fusionnée par segment du corps**, couleurs par sommet, en cache par type.
- Les segments sont ceux de `SEGS` : `pelvis`, `chest`, `head`, `uarmL/R`, `farmL/R`, `thighL/R`, `shinL/R`. Chaque géométrie est accrochée à l'os correspondant dans `Fighter` (`this.J`).
- L'apparence vient de `TYPES[type].look` dans `00_core.js` : `skin`, `top`, `bottom`, `trim`, `armor`, `kilt`, `fur`, `bare`, `tabard`… On peut changer le style en profondeur dans `04_models.js`, à condition de garder **un maillage par segment, avec la même origine et le même axe**. Sinon les membres tranchés, les moignons et les plaies (`capAt`, `limbMark`, `torsoMark`, `guts`) se placent mal.
- Les coups touchent des **capsules** définies par `SEGS` (rayon `r`) et `D` (longueurs des os), **pas les maillages**. Changer `D` ou `SEGS` modifie le gameplay : portée, coups de pied, IK des jambes. Pour un simple changement de look, ne toucher qu'aux géométries et aux couleurs.

### Armes, armures, effets

- Armes : `Models.weaponGeo(id)` dans `04_models.js`. Si `BLENDER[id]` existe (fichier généré `src/js/04a_blender.js`), le modèle Blender remplace le modèle en code. Les modèles Blender sont des scripts Python dans `blender/` (ex. `blender/katana.py`), lancés avec le module `bpy` (`pip install bpy`, Blender 5.3) : `python3 blender/katana.py` régénère `04a_blender.js`. Ne jamais éditer ce fichier à la main. Les statistiques sont dans `WEAPONS` (`len` = longueur de lame utilisée pour les touches).
- Armures : modèles et casse dans `08_armor_water.js`.

### Arènes, lumières, rendu

- Arènes : `Env` dans `02_gfx.js`, une par clé de `ARENAS` (`dojo`, `bridge`, `fortress`).
- Lumières, brouillard, exposition et bloom par arène : `PALETTES`.
- Textures : générées sur canvas. Celles des arènes sont dans `02b_textures.js` (`Tex.dojoFloor`, `burntFloor`, `wall`, `planks`) : chaque pixel donne couleur, hauteur et rugosité, et `Tex.mat` en fait un matériau (carte de normales + carte de rugosité). Il n'y a aucun fichier image.
- Personnages : `blender/personnages.py` construit tous les types (apparence dans `blender/looks.json`) et régénère `src/js/04c_perso.js`.

### Performances

- Le jeu doit tourner sur téléphone. Fusionner les géométries (`mergeGeos`) et éviter de multiplier les matériaux et les lumières.
- `CFG.touch` indique un écran tactile. `CFG.lite` est le mode allégé (sans ombres, entre autres). Il est activé d'office sur tactile, et une case du menu le règle aussi. Tout nouvel effet coûteux doit le respecter.

### Interface

- Respecter la largeur téléphone (390 px) : pas de débordement horizontal, et les boutons tactiles (`#touch`, positionnés en absolu) ne doivent pas se chevaucher.
- Sur téléphone (hors duel), la boîte « Vague » est placée en haut à droite pour ne pas couvrir les barres de vie.

## Gameplay : invariants à ne pas casser

- **Combat :**
  - `Combat.start` crée une action `attack` en trois phases : élan (0), frappe (1), retour (2).
  - `Combat.sweep` sous-échantillonne l'arc et appelle `test`, puis `resolve` ou `blocked`.
  - Les coups de pied ont `kind: 'kick'` et une variante `kv` (`k540`, `front`, `round`, `low`). Leur géométrie analytique, `Combat.kickGeo`, sert à la fois à l'animation (pieds et bassin dans `Fighter.kickFeet`) et aux touches.
- **Projection :**
  - `Fighter.launch` fait voler le combattant sur le dos (`action.fly`). Un mur l'arrête.
  - En vol, il renverse ceux qu'il percute (effet quilles). La liste `fly.hit` est partagée par toute la chaîne pour que chacun ne soit renversé qu'une fois.
- **Rythme :** `GAME_SPEED` (00_core.js, 0,85) ralentit tout le jeu ; `DASH_CD` impose 4 s entre deux dashs du joueur. L IA punit les coups ratés, vise les membres déjà blessés, brise les gardes tenues, recule devant le retourné et prend le joueur à revers quand un autre attaque.
- **Style « Jambes » :** arme `legs` de type `fist`. Le clic gauche enchaîne coup de face, circulaire et balayage. Le coup lourd déclenche le retourné. Mains dans le dos, petits rebonds. Il porte l'élément choisi (touche E) : feu, glace ou foudre enveloppent la jambe, s'appliquent aux touches et donnent le pouvoir correspondant ; en acier, pas d'effet. Finisher : talon abattu (`A.stomp`, `advanceStomp`/`stompGeo`/`stompHit` dans 08_armor_water.js), tête visée = crâne écrasé. Les bras pendant un coup de pied viennent de `kickGeo` (`aR`, `aL`, `arms`).

### Duel en ligne (08e_net.js)

- **Principe :**
  - Chaque client est maître de son propre combattant. L'adversaire est une marionnette `Fighter('rival')` avec `net = true`, qui rejoue ses actions.
  - **Les touches sont jugées chez la victime** : parade et garde décidées localement. Le résultat revient à l'attaquant.
  - L'hôte, c'est-à-dire celui qui défie, décide des manches.
- **Transports :**
  - Salon Claude (capacité `room`, présence ≤ 4 KiB, clés d'identifiant, aucun caractère invisible) : seulement dans la page Claude, pour des personnes invitées et connectées.
  - Code en connexion directe : PeerJS 1.5.5 chargé depuis jsdelivr, serveur public `0.peerjs.com`, WebRTC. Il marche sur le site, pas dans la page Claude.
  - BroadcastChannel entre onglets du même navigateur.
- **À respecter :**
  - Tout nouveau geste doit être transmis (`note`/`applyEv`, `packOpts`/`unpackOpts` avec liste blanche des valeurs).
  - Tout ce qui vient de l'autre joueur est non fiable : on borne avec `num()` et on filtre.

## Tests

`test/*.js` sont des scripts Playwright (Chromium headless, SwiftShader). Chemins à adapter : ils supposent Playwright dans `/opt/npm-tools/node_modules/playwright`.

| Script | Ce qu'il vérifie |
|---|---|
| `moves.js index.html` | Dash, attaques, parade, ennemis |
| `kick.js` | Retourné, projection, quilles, style des jambes, garde, mur |
| `phone.js` | Mise en page téléphone, chevauchement des boutons |
| `run12.js light 1 3000 10` | Donjon jusqu'à la vague 10, NaN, mémoire |
| `duel.js 90 40`, `duel2.js 120 60`, `duelkick.js 90 40` | Duel entre deux onglets avec latence simulée. Ils lisent `http://127.0.0.1:8765/test/index.html` : lancer `python3 -m http.server 8765 --bind 127.0.0.1` à la racine. |
| `duelcode.js` | Duel par code. Il faut un serveur PeerJS local (paquet npm `peer`). |
| `film.js` | Images d'animation côte à côte, dans `shots/`. |

Après toute modification, un minimum : build, contrôle de syntaxe, `moves.js`, et le donjon jusqu'à la vague 10, sans erreur console.

## Pièges connus

- Ne pas écrire d'échappements `\uXXXX` via des outils qui les réinterprètent. Préférer `\p{…}` avec le drapeau `u`, ou `String.fromCharCode`.
- Lancer **un seul navigateur headless à la fois** : la mémoire est limitée.
- Les rendus SwiftShader sont lents : un `film.js` peut prendre plusieurs minutes.
- GitHub Pages gratuit exige un dépôt public.

## Historique des grandes étapes

1. Moteur 3D, combat par membres en trois coups, sang, ragdolls, armes, lames élémentaires, vagues, boss.
2. Armures, pouvoir Eau, parade parfaite, kunai, bourrade, tutoriel, téléphone.
3. Refonte des mouvements : pas posés, roulé du pied, dash, attaques menées par les hanches.
4. Duel 1v1 en ligne : salon Claude, puis code en connexion directe sur le site.
5. Coups de pied : retourné sauté qui projette, quilles renversées, style « Jambes ».
