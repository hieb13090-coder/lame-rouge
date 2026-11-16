# Transforme les animations Mixamo extraites (JSON de extraire.py) en données compactes pour le jeu : src/js/04b_mocap.js
# Mains en repère « taille » du jeu (+X gauche, +Y haut, +Z devant, origine à la taille), mises à l'échelle du squelette du jeu.
# Les cycles de marche et de course commencent quand le pied gauche se pose (phase 0 de la foulée du jeu).
import json, sys, os, math
HIP_H, WAIST = 0.96, 0.14
def load(n): return json.load(open(n))['frames']
def clip(name, cyc, N):
    F = load(name + '.json')
    if cyc: F = F[:-1]                                         # Mixamo répète la première image à la fin
    hh = sum(f['hips'][1] for f in F) / len(F); k = HIP_H / hh
    if cyc:                                                    # pose du pied gauche : il est le plus en avant
        i0 = max(range(len(F)), key=lambda i: F[i]['lf'][2]); F = F[i0:] + F[:i0]
    out = []
    for j in range(N):
        t = j / N * len(F) if cyc else j / (N - 1) * (len(F) - 1)
        a = int(t) % len(F); b = (a + 1) % len(F); u = t - int(t)
        L = lambda key, c: F[a][key][c] * (1 - u) + F[b][key][c] * u
        for key in ('rh', 'lh'):
            out += [round(L(key, 0) * k, 3), round(L(key, 1) * k - WAIST, 3), round(L(key, 2) * k, 3)]
    return out
C = {'gsidle': clip('gsidle', True, 40), 'gswalk': clip('gswalk', True, 24), 'gsrun': clip('gsrun', True, 16),
     'walk': clip('walk', True, 24), 'run': clip('run', True, 16)}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'js', '04b_mocap.js')
open(dst, 'w').write("// ======================================================================\n// 04b — animations capturées (Mixamo), converties par blender/mixamo/exporter.py. Ne pas éditer à la main.\n"
  "// Chaque cycle : images de 6 nombres (main droite x,y,z puis main gauche x,y,z), en repère de la taille du jeu.\n// ======================================================================\n"
  "const MOCAP = " + json.dumps(C, separators=(',', ':')) + ";\n")
print({k: len(v) // 6 for k, v in C.items()}, os.path.getsize(dst), 'octets')
