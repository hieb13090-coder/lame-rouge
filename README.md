# Lame Rouge

Jeu de combat de samouraïs en 3D, dans le navigateur (three.js r128).
Donjon par vagues, bac à sable, tutoriel et duel 1v1 en ligne par code.

**Jouer :** https://hieb13090-coder.github.io/lame-rouge/

## Démarrer

Il faut [Node.js](https://nodejs.org) (version 18 ou plus).

```bash
npm install      # installe three.js 0.128
npm run build    # reconstruit le jeu
```

Ensuite, ouvre `index.html` dans Chrome (double-clic) : c'est le jeu complet, en un seul fichier.

**Ne modifie jamais `index.html` à la main.** Il est régénéré à chaque `npm run build` à partir de `src/`.

## Où est quoi

Tout le jeu est dans `src/`. Le build colle `src/head.html` et les fichiers `src/js/*.js` dans l'ordre de leur nom.

Il n'y a aucune image ni aucun modèle 3D importé : personnages, armes, arènes et effets sont construits en code (formes three.js, couleurs, matériaux). Les sons sont synthétisés aussi.

### Partie graphique

| Fichier | Contenu |
|---|---|
| `src/head.html` | Tout le HTML et le CSS : menus, HUD, boutons tactiles. Les couleurs de l'interface sont des variables CSS dans `:root` (`--beni`, `--washi`, `--sumi`…). Polices Google : Shippori Mincho et Zen Kaku Gothic. |
| `src/js/02_gfx.js` | Rendu 3D : moteur, lumières, ombres, arènes (sol, murs, décor), particules, sang, traînées des lames. |
| `src/js/04_models.js` | Modèles des personnages (corps, tenues), des armes, des plaies et des os. |
| `src/js/08_armor_water.js` | Modèles des armures ; effet du pouvoir Eau. |
| `src/js/08c_powers.js` | Effets des autres pouvoirs (feu, glace, foudre) et de la parade parfaite. |
| `src/js/00_core.js` | Données : arènes (`ARENAS`), types d'ennemis et leurs couleurs (`TYPES`), armes (`WEAPONS`). |

### Le reste (gameplay, à ne toucher qu'en sachant ce qu'on fait)

| Fichier | Contenu |
|---|---|
| `src/js/01_audio.js` | Sons synthétisés. |
| `src/js/03_physics.js` | Ragdolls, membres tranchés, armes lâchées. |
| `src/js/05_fighter.js` | Squelette, marche, jambes, bras, animations. |
| `src/js/05b_wounds.js` | Blessures, démembrement, hémorragie. |
| `src/js/06_combat.js` | Coups (lames et coups de pied), garde, parade. |
| `src/js/07_ai_player.js` | IA des ennemis, commandes du joueur, caméra. |
| `src/js/08b_extras.js`, `08d_tuto.js` | Kunai, bourrade, corbeaux ; tutoriel. |
| `src/js/08e_net.js` | Duel 1v1 en ligne (salon Claude et code en connexion directe via PeerJS). |
| `src/js/09_game.js` | Modes, vagues, progression, interface, boucle principale. |

## Publier une modification

1. Modifie les fichiers dans `src/`.
2. `npm run build`, puis ouvre `index.html` pour vérifier.
3. Commit et push sur `main`, en incluant le nouvel `index.html`.

Le site se met à jour tout seul environ une minute après le push.

Pour travailler à deux sans se gêner : une branche par sujet (par exemple `graphismes-arenes`), puis une pull request vers `main`.

## Tests

`test/` contient les vérifications automatiques (Playwright) : combats, coups de pied, duel, téléphone, donjon jusqu'à la vague 10. Elles servent surtout à vérifier qu'une modification ne casse rien. Leurs chemins sont à adapter selon la machine.
