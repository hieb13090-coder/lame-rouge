# Rōnin du joueur modélisé dans Blender (bpy), exporté par segment du corps pour le jeu : src/js/04c_perso.js
# Chaque segment garde l'origine et l'axe du modèle en code (voir CLAUDE.md) :
#   pelvis : origine aux hanches · chest : à la taille, vers le haut · head : à la base du cou, vers le haut
#   uarm : à l'épaule, vers le bas (-Y) · farm : au coude, vers le bas, main au bout · thigh : à la hanche, vers le bas
#   shin : au genou, vers le bas · foot : à la cheville, orteils vers +Z.  Repère : +X gauche, +Y haut, +Z devant.
# Lancer : python3 blender/personnage.py
import bpy, bmesh, math, base64, struct, os
bpy.ops.wm.read_factory_settings(use_empty=True)

def col(h): return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)
SKIN, TOP, BOT, TRIM, INNER, HAIR = col(0xb98a68), col(0x1b2030), col(0x121318), col(0x6a1512), col(0x6a1512), col(0x0c0a09)
DARK = lambda c, f: tuple(x * f for x in c)
GOLD, LACQ, CREAM, ROPE, SOLE = col(0xa8842e), col(0x111114), col(0xd8cfba), col(0x8a7350), col(0x3a2a1a)
SEG = {}                                                      # segment -> liste d'objets

def finish(ob, seg, smooth=True, sub=1):
    for p in ob.data.polygons: p.use_smooth = smooth
    if sub:
        m = ob.modifiers.new('sub', 'SUBSURF'); m.levels = sub; m.render_levels = sub
    SEG.setdefault(seg, []).append(ob); return ob

def paint(ob, fn):
    """fn(x, y, z) -> couleur, appliquée à chaque coin de face."""
    me = ob.data; ca = me.color_attributes.new('col', 'FLOAT_COLOR', 'CORNER')
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co; c = fn(v.x, v.y, v.z); ca.data[li].color = (*c, 1)

def loft(seg, rings, color, n=20, cap0=True, cap1=True, sub=1, smooth=True):
    """rings : (y, rx, rz, cx, cz) ; color : couleur fixe ou fonction (x, y, z)."""
    me = bpy.data.meshes.new(seg); bm = bmesh.new(); R = []
    for (y, rx, rz, cx, cz) in rings:
        R.append([bm.verts.new((cx + rx * math.cos(2 * math.pi * i / n), y, cz + rz * math.sin(2 * math.pi * i / n))) for i in range(n)])
    for a, b in zip(R, R[1:]):
        for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap0: bm.faces.new(R[0])
    if cap1: bm.faces.new(list(reversed(R[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(seg, me); bpy.context.collection.objects.link(ob)
    paint(ob, color if callable(color) else (lambda x, y, z: color)); return finish(ob, seg, smooth, sub)

def prim(seg, kind, color, loc, scale=(1, 1, 1), rot=(0, 0, 0), sub=1, **kw):
    getattr(bpy.ops.mesh, 'primitive_' + kind + '_add')(location=loc, rotation=rot, **kw)
    ob = bpy.context.active_object; ob.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    paint(ob, color if callable(color) else (lambda x, y, z: color)); return finish(ob, seg, True, sub)

# ---------------------------------------------------------------- bassin : haut du hakama, ceinture (obi), saya au côté
loft('pelvis', [(-0.2, 0.17, 0.125, 0, 0), (-0.06, 0.162, 0.118, 0, 0), (0.06, 0.15, 0.108, 0, 0), (0.15, 0.142, 0.1, 0, -0.004)], BOT)
loft('pelvis', [(0.07, 0.158, 0.115, 0, 0), (0.1, 0.162, 0.118, 0, 0), (0.135, 0.158, 0.115, 0, 0), (0.15, 0.152, 0.11, 0, 0)], TRIM, cap0=False, cap1=False)
prim('pelvis', 'uv_sphere', TRIM, (0, 0.105, -0.12), (0.06, 0.045, 0.035), segments=12, ring_count=8)        # nœud de l'obi
prim('pelvis', 'cylinder', LACQ, (0.18, 0.03, -0.2), (0.021, 0.021, 0.36), rot=(-0.35, 0, 0), vertices=10, sub=0)   # saya : la poignée devant, le fourreau descend derrière
prim('pelvis', 'cylinder', GOLD, (0.168, 0.152, 0.13), (0.025, 0.025, 0.012), rot=(-0.35, 0, 0), vertices=10, sub=0)
# ---------------------------------------------------------------- torse : kimono, revers croisés, poitrine et épaules
def kimono(x, y, z):
    if z > 0.02 and y > 0.16:                                 # revers en V : col intérieur rouge puis peau
        lap = abs(x) < (y - 0.2) * 0.3 + 0.01
        if lap: return SKIN if abs(x) < (y - 0.3) * 0.28 else INNER
    if y < 0.02: return TRIM
    return TOP
loft('chest', [(0.0, 0.142, 0.1, 0, 0), (0.08, 0.15, 0.105, 0, 0.004), (0.18, 0.168, 0.115, 0, 0.01), (0.27, 0.19, 0.12, 0, 0.012),
               (0.34, 0.2, 0.112, 0, 0.004), (0.385, 0.165, 0.095, 0, -0.004), (0.415, 0.09, 0.075, 0, -0.006), (0.44, 0.056, 0.055, 0, 0.0)], kimono, n=24)
loft('chest', [(0.41, 0.058, 0.056, 0, 0.004), (0.47, 0.05, 0.048, 0, 0.008)], SKIN, cap0=False)                # cou
for sx in (-1, 1):                                            # muscle de l'épaule sous le tissu
    prim('chest', 'uv_sphere', TOP, (sx * 0.2, 0.355, -0.005), (0.075, 0.06, 0.07), segments=12, ring_count=8)
# ---------------------------------------------------------------- tête : crâne, mâchoire, nez, sourcils, yeux, oreilles, cheveux, bandeau
def face(x, y, z):
    if y > 0.14 or (z < 0.0 and y > 0.04) or (z < 0.05 and y > 0.12 and abs(x) > 0.06): return HAIR     # cheveux : sommet, arrière, tempes
    if z > 0.04 and 0.02 < y < 0.075: return DARK(SKIN, 0.78)                     # barbe de trois jours
    if z > 0.07 and 0.105 < y < 0.12 and 0.018 < abs(x) < 0.05: return col(0x140f0c)  # yeux
    if 0.02 < x < 0.03 and 0.09 < y < 0.15 and z > 0.06: return DARK(SKIN, 0.65)     # cicatrice
    return SKIN
loft('head', [(0.0, 0.05, 0.05, 0, 0.005), (0.03, 0.068, 0.075, 0, 0.014), (0.07, 0.078, 0.088, 0, 0.012), (0.12, 0.084, 0.094, 0, 0.004),
              (0.17, 0.086, 0.096, 0, -0.004), (0.215, 0.07, 0.08, 0, -0.008), (0.245, 0.03, 0.035, 0, -0.008)], face, n=22)
prim('head', 'cone', SKIN, (0, 0.1, 0.098), (0.016, 0.018, 0.034), rot=(-1.4, 0, 0), vertices=8)               # nez
for sx in (-1, 1):
    prim('head', 'cube', HAIR, (sx * 0.032, 0.128, 0.088), (0.022, 0.005, 0.007), rot=(0, 0, sx * -0.18), sub=0)   # sourcils
    prim('head', 'uv_sphere', SKIN, (sx * 0.086, 0.115, -0.005), (0.012, 0.026, 0.017), segments=8, ring_count=6)   # oreilles
hair = loft('head', [(0.125, 0.089, 0.099, 0, -0.008), (0.18, 0.091, 0.1, 0, -0.01), (0.225, 0.074, 0.084, 0, -0.012), (0.255, 0.035, 0.04, 0, -0.012)], HAIR, n=22, cap0=False)
prim('head', 'uv_sphere', HAIR, (0, 0.235, -0.07), (0.03, 0.028, 0.035), segments=10, ring_count=8)             # chignon
loft('head', [(0.24, 0.016, 0.016, 0, -0.085), (0.16, 0.02, 0.018, 0, -0.13), (0.06, 0.012, 0.012, 0, -0.14)], HAIR, n=8)   # queue de cheval
loft('head', [(0.155, 0.093, 0.103, 0, -0.006), (0.185, 0.094, 0.104, 0, -0.008)], TRIM, cap0=False, cap1=False)  # bandeau
for sx in (-1, 1):
    prim('head', 'cube', TRIM, (sx * 0.02, 0.12, -0.12), (0.012, 0.06, 0.004), rot=(0.3, 0, sx * 0.15), sub=0)    # pans du bandeau
# ---------------------------------------------------------------- bras : grande manche du kimono, avant-bras, poing
loft('uarm', [(0.03, 0.07, 0.07, 0, 0), (-0.06, 0.08, 0.085, 0, 0.004), (-0.18, 0.088, 0.1, 0, 0.01), (-0.27, 0.09, 0.115, 0, 0.018), (-0.3, 0.084, 0.118, 0, 0.02)], TOP, n=18, cap1=False)
loft('uarm', [(-0.29, 0.082, 0.112, 0, 0.02), (-0.305, 0.07, 0.1, 0, 0.02)], DARK(TOP, 0.6), n=18, cap0=False)
def arm(x, y, z): return TOP if y > -0.12 else SKIN
loft('farm', [(0.02, 0.05, 0.05, 0, 0), (-0.08, 0.05, 0.048, 0, 0), (-0.12, 0.044, 0.042, 0, 0), (-0.2, 0.038, 0.036, 0, 0), (-0.255, 0.031, 0.03, 0, 0)], arm, n=14)
loft('farm', [(-0.1, 0.062, 0.07, 0, 0), (-0.14, 0.058, 0.066, 0, 0)], DARK(TOP, 0.55), n=14, cap0=False, cap1=False)   # revers de manche
prim('farm', 'uv_sphere', SKIN, (0, -0.3, 0.008), (0.042, 0.05, 0.034), segments=12, ring_count=8)             # paume
for i in range(4):                                                                                               # doigts repliés
    prim('farm', 'uv_sphere', SKIN, (0.026 - i * 0.017, -0.338, 0.024), (0.009, 0.014, 0.013), segments=8, ring_count=6, sub=0)
prim('farm', 'uv_sphere', SKIN, (-0.03, -0.31, 0.032), (0.01, 0.022, 0.011), rot=(0, 0, 0.5), segments=8, ring_count=6, sub=0)   # pouce
for y in (-0.21, -0.235):                                                                                         # bandes de cuir au poignet
    loft('farm', [(y, 0.038, 0.036, 0, 0), (y - 0.012, 0.037, 0.035, 0, 0)], col(0x4a3220), n=14, cap0=False, cap1=False, sub=0)
# ---------------------------------------------------------------- jambes : hakama ample, plis, bas serré, tabi et sandales
def pleat(x, y, z):
    a = math.atan2(x, z); return DARK(BOT, 0.72) if math.cos(a * 6) > 0.86 else BOT
loft('thigh', [(0.04, 0.105, 0.105, 0, 0), (-0.12, 0.112, 0.112, 0, 0.003), (-0.3, 0.118, 0.12, 0, 0.006), (-0.45, 0.12, 0.122, 0, 0.008)], pleat, n=24, cap1=False)
loft('shin', [(0.03, 0.118, 0.12, 0, 0.004), (-0.1, 0.116, 0.118, 0, 0.004), (-0.24, 0.11, 0.11, 0, 0.002), (-0.3, 0.098, 0.098, 0, 0)], pleat, n=24, cap0=False)
loft('shin', [(-0.3, 0.06, 0.06, 0, 0), (-0.34, 0.048, 0.05, 0, 0), (-0.42, 0.044, 0.046, 0, 0)], CREAM, n=14)     # jambière blanche
for y in (-0.315, -0.355, -0.395):
    loft('shin', [(y, 0.05, 0.052, 0, 0), (y - 0.01, 0.049, 0.051, 0, 0)], ROPE, n=14, cap0=False, cap1=False, sub=0)
loft('foot', [(0.0, 0.042, 0.042, 0, 0), (-0.035, 0.046, 0.06, 0, 0.03), (-0.05, 0.045, 0.1, 0, 0.06)], CREAM, n=14)   # tabi
prim('foot', 'uv_sphere', CREAM, (0, -0.045, 0.15), (0.042, 0.022, 0.05), segments=12, ring_count=8)
prim('foot', 'cube', SOLE, (0, -0.068, 0.055), (0.05, 0.007, 0.13), sub=0)                                        # waraji
prim('foot', 'cube', ROPE, (0, -0.05, 0.11), (0.046, 0.006, 0.007), rot=(0.6, 0, 0), sub=0)

# ---------------------------------------------------------------- export
def dump(objs):
    P, N, C = [], [], []; dg = bpy.context.evaluated_depsgraph_get()
    for ob in objs:
        me = ob.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); cl = me.color_attributes[0].data
        for tri in me.loop_triangles:
            for li, vi in zip(tri.loops, tri.vertices):
                p = me.vertices[vi].co; P += [p.x, p.y, p.z]
                n = me.corner_normals[li].vector; N += [n.x, n.y, n.z]
                c = cl[li].color; C += [c[0], c[1], c[2]]
    # compression : positions en entiers 16 bits (1/8000 m), normales et couleurs en 8 bits
    q = lambda a, k, f: base64.b64encode(struct.pack('<%d%s' % (len(a), f), *[max(-32767, min(32767, round(v * k))) if f == 'h' else max(-127, min(127, round(v * k))) if f == 'b' else max(0, min(255, round(v * k))) for v in a])).decode()
    return '{ p: "%s", n: "%s", c: "%s" }' % (q(P, 8000, 'h'), q(N, 127, 'b'), q(C, 255, 'B')), len(P) // 9
parts, tot = [], 0
for seg in ('pelvis', 'chest', 'head', 'uarm', 'farm', 'thigh', 'shin', 'foot'):
    s, n = dump(SEG[seg]); parts.append('    %s: %s' % (seg, s)); tot += n; print(seg, n, 'triangles')
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'js', '04c_perso.js')
open(out, 'w').write("// ======================================================================\n// 04c — personnages faits dans Blender (blender/personnage.py). Ne pas éditer à la main : relancer le script.\n"
                     "// ======================================================================\nconst BLENDER_FIGHTER = {\n  player: {\n" + ',\n'.join(parts) + "\n  },\n};\n")
print('total', tot, 'triangles ->', os.path.getsize(out), 'octets')
