# Tous les combattants modélisés dans Blender (bpy), exportés par segment du corps : src/js/04c_perso.js
# L'apparence de chaque type vient de blender/looks.json (copie des « look » de TYPES, regénérée par le script node en tête).
# Repère et origines des segments : voir CLAUDE.md (pelvis aux hanches, chest à la taille, head à la base du cou,
# uarm à l'épaule vers -Y, farm au coude vers -Y, thigh à la hanche, shin au genou, foot à la cheville, +Z devant, +X gauche).
# Lancer : python3 blender/personnages.py
import bpy, bmesh, math, base64, struct, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
LOOKS = json.load(open(os.path.join(HERE, 'looks.json')))

def col(h): return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)
def dk(c, f): return tuple(min(1, x * f) for x in c)
GOLD, LACQ, CREAM, ROPE, SOLE, STEEL, LEATHER, FUR = col(0xa8842e), col(0x141417), col(0xd8cfba), col(0x8a7350), col(0x3a2a1a), col(0x8f979f), col(0x4a3220), col(0x4f4336)

def build(k, tid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SEG = {}
    SK, TOP, BOT, TRIM = col(k['skin']), col(k['top']), col(k['bottom']), col(k['trim'])
    INNER, HAIR = col(k.get('inner', k['trim'])), col(k.get('hair', 0x111111))
    hak = not k.get('kilt') and k.get('armor') != 'plate' and not k.get('fur') and not k.get('plain') and not k.get('bare')
    robe, bare, plate, do, fur, kilt, plain = hak and not k.get('armor'), k.get('bare'), k.get('armor') == 'plate', k.get('armor') == 'do', k.get('fur'), k.get('kilt'), k.get('plain')
    japan = hak or bare or tid in ('bandit', 'vagabond')

    def finish(ob, seg, sub):
        for p in ob.data.polygons: p.use_smooth = True
        if sub: m = ob.modifiers.new('sub', 'SUBSURF'); m.levels = sub
        SEG.setdefault(seg, []).append(ob); return ob
    def paint(ob, fn):
        me = ob.data; ca = me.color_attributes.new('col', 'FLOAT_COLOR', 'CORNER')
        for poly in me.polygons:
            for li in poly.loop_indices:
                v = me.vertices[me.loops[li].vertex_index].co; ca.data[li].color = (*fn(v.x, v.y, v.z), 1)
    def loft(seg, rings, color, n=16, cap0=True, cap1=True, sub=1):
        me = bpy.data.meshes.new(seg); bm = bmesh.new(); R = []
        for (y, rx, rz, cx, cz) in rings:
            R.append([bm.verts.new((cx + rx * math.cos(2 * math.pi * i / n), y, cz + rz * math.sin(2 * math.pi * i / n))) for i in range(n)])
        for a, b in zip(R, R[1:]):
            for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        if cap0: bm.faces.new(R[0])
        if cap1: bm.faces.new(list(reversed(R[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(seg, me); bpy.context.collection.objects.link(ob)
        paint(ob, color if callable(color) else (lambda x, y, z: color)); return finish(ob, seg, sub)
    def prim(seg, kind, color, loc, scale=(1, 1, 1), rot=(0, 0, 0), sub=0, **kw):
        getattr(bpy.ops.mesh, 'primitive_' + kind + '_add')(location=loc, rotation=rot, **kw)
        ob = bpy.context.active_object; ob.scale = scale; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        paint(ob, color if callable(color) else (lambda x, y, z: color)); return finish(ob, seg, sub)
    def sph(seg, c, loc, sc, sub=0, seg_n=10): return prim(seg, 'uv_sphere', c, loc, sc, segments=seg_n, ring_count=max(6, seg_n * 2 // 3), sub=sub)
    def box(seg, c, loc, sc, rot=(0, 0, 0)): return prim(seg, 'cube', c, loc, sc, rot)
    def cyl(seg, c, loc, sc, rot=(0, 0, 0), v=12): return prim(seg, 'cylinder', c, loc, sc, rot, vertices=v)

    # ---------------- bassin
    if kilt:
        def tartan(x, y, z): a = math.atan2(x, z); return TRIM if (math.cos(a * 9) > 0.8 or abs((y * 30) % 1 - 0.5) < 0.08) else BOT
        loft('pelvis', [(-0.38, 0.25, 0.2, 0, 0), (-0.2, 0.2, 0.16, 0, 0), (0.0, 0.165, 0.12, 0, 0), (0.15, 0.15, 0.11, 0, 0)], tartan, n=20)
        box('pelvis', LEATHER, (0, -0.07, 0.17), (0.045, 0.055, 0.015))                      # sporran
    else:
        lowc = BOT if not plate else STEEL
        loft('pelvis', [(-0.2, 0.17, 0.125, 0, 0), (-0.06, 0.162, 0.118, 0, 0), (0.06, 0.15, 0.108, 0, 0), (0.15, 0.142, 0.1, 0, 0)], lowc)
    belt = LEATHER if (plate or fur or kilt) else TRIM
    loft('pelvis', [(0.07, 0.158, 0.115, 0, 0), (0.1, 0.162, 0.118, 0, 0), (0.135, 0.158, 0.115, 0, 0)], belt, cap0=False, cap1=False, sub=0)
    if hak: sph('pelvis', TRIM, (0, 0.105, -0.12), (0.06, 0.045, 0.035))                   # nœud de l'obi
    if do:
        for i in (-1, 0, 1):
            for zs in (1, -1): box('pelvis', LACQ, (i * 0.105, -0.08, zs * (0.13 - abs(i) * 0.02)), (0.05, 0.1, 0.012))   # kusazuri
    if k.get('tabard'):
        for zs in (1, -1): box('pelvis', col(k['tabard']), (0, -0.16, zs * 0.125), (0.1, 0.22, 0.008))
    if tid in ('player', 'ronin', 'oni', 'rival'):
        cyl('pelvis', LACQ, (0.18, 0.03, -0.2), (0.021, 0.021, 0.36), rot=(-0.35, 0, 0), v=10)                       # saya
        cyl('pelvis', GOLD, (0.168, 0.152, 0.13), (0.025, 0.025, 0.012), rot=(-0.35, 0, 0), v=10)
    # ---------------- torse
    def torso(x, y, z):
        if bare: return dk(SK, 0.93) if (abs(x) < 0.01 and z > 0) else SK
        if plate: return STEEL
        if z > 0.02 and y > 0.2 and hak:
            if abs(x) < (y - 0.2) * 0.3 + 0.01: return SK if abs(x) < (y - 0.3) * 0.28 else INNER
        if y < 0.02: return belt
        return TOP
    tw = 1.1 if tid in ('oni', 'viking', 'highlander') else 1.0
    loft('chest', [(0.0, 0.142 * tw, 0.1, 0, 0), (0.08, 0.15 * tw, 0.105, 0, 0.004), (0.18, 0.168 * tw, 0.115, 0, 0.01), (0.27, 0.19 * tw, 0.12, 0, 0.012),
                   (0.34, 0.2 * tw, 0.112, 0, 0.004), (0.385, 0.165 * tw, 0.095, 0, -0.004), (0.415, 0.09, 0.075, 0, -0.006), (0.44, 0.056, 0.055, 0, 0.0)], torso, n=20)
    loft('chest', [(0.41, 0.058, 0.056, 0, 0.004), (0.47, 0.05, 0.048, 0, 0.008)], SK, cap0=False, sub=0)
    if bare:
        for sx in (-1, 1): sph('chest', SK, (sx * 0.07, 0.29, 0.1), (0.075, 0.055, 0.03))                   # pectoraux
        loft('chest', [(0.02, 0.15, 0.106, 0, 0), (0.05, 0.152, 0.108, 0, 0)], ROPE, cap0=False, cap1=False, sub=0)
    for sx in (-1, 1): sph('chest', STEEL if plate else (TOP if not bare else SK), (sx * 0.2, 0.355, -0.005), (0.075, 0.06, 0.07))
    if do:
        for i in range(4): loft('chest', [(0.08 + i * 0.07, 0.172 + i * 0.01, 0.126 + i * 0.004, 0, 0.01), (0.135 + i * 0.07, 0.178 + i * 0.01, 0.13 + i * 0.004, 0, 0.012)], LACQ if i % 2 == 0 else dk(LACQ, 1.6), n=20, cap0=False, cap1=False, sub=0)
        for sx in (-1, 1): box('chest', LACQ, (sx * 0.27, 0.3, 0), (0.07, 0.09, 0.08), rot=(0, 0, -sx * 0.4))        # sode
        box('chest', GOLD, (0, 0.33, 0.135), (0.03, 0.03, 0.006))
    if plate:
        for sx in (-1, 1): sph('chest', STEEL, (sx * 0.23, 0.37, 0), (0.09, 0.075, 0.095))
        if k.get('tabard'): box('chest', col(k['tabard']), (0, 0.18, 0.135), (0.11, 0.18, 0.006)); box('chest', col(0x7a1512), (0, 0.2, 0.142), (0.015, 0.1, 0.004)); box('chest', col(0x7a1512), (0, 0.245, 0.142), (0.06, 0.015, 0.004))
    if fur: loft('chest', [(0.3, 0.2, 0.13, 0, 0), (0.37, 0.22, 0.14, 0, -0.01), (0.43, 0.13, 0.11, 0, -0.02)], FUR, n=16, cap0=False, sub=1)
    # ---------------- tête
    paint_c = col(k['paint']) if k.get('paint') else None
    def face(x, y, z):
        if k.get('hat') == 'mask' and z > 0.02 and 0.0 < y < 0.1: return dk(TRIM, 1.2)
        hairy = k.get('hairStyle') not in (None, 'buzz') or k.get('hat') in ('headband', 'none')
        if hairy and (y > 0.15 or (z < 0.0 and y > 0.05) or (z < 0.05 and y > 0.12 and abs(x) > 0.06)) and k.get('hairStyle') != 'buzz': return HAIR
        if k.get('hairStyle') == 'buzz' and y > 0.16: return dk(HAIR, 1.6)
        if paint_c and z > 0.06 and 0.08 < y < 0.15 and abs(x) > 0.015: return paint_c
        if k.get('stubble') and z > 0.04 and 0.02 < y < 0.075: return dk(SK, 0.8)
        if z > 0.07 and 0.105 < y < 0.12 and 0.018 < abs(x) < 0.05: return col(0x140f0c)
        if k.get('scar') and 0.02 < x < 0.03 and 0.09 < y < 0.15 and z > 0.06: return dk(SK, 0.65)
        return SK
    loft('head', [(0.0, 0.05, 0.05, 0, 0.005), (0.03, 0.068, 0.075, 0, 0.014), (0.07, 0.078, 0.088, 0, 0.012), (0.12, 0.084, 0.094, 0, 0.004),
                  (0.17, 0.086, 0.096, 0, -0.004), (0.215, 0.07, 0.08, 0, -0.008), (0.245, 0.03, 0.035, 0, -0.008)], face, n=18)
    prim('head', 'cone', SK, (0, 0.1, 0.098), (0.016, 0.018, 0.034), rot=(-1.4, 0, 0), vertices=8)
    for sx in (-1, 1):
        box('head', HAIR, (sx * 0.032, 0.128, 0.088), (0.022, 0.005, 0.007), rot=(0, 0, sx * -0.18))
        sph('head', SK, (sx * 0.086, 0.115, -0.005), (0.012, 0.026, 0.017), seg_n=8)
    hs, hat = k.get('hairStyle'), k.get('hat')
    if hs in ('ponytail', 'topknot'): sph('head', HAIR, (0, 0.24, -0.06 if hs == 'ponytail' else -0.02), (0.028, 0.026, 0.034))
    if hs == 'ponytail': loft('head', [(0.24, 0.016, 0.016, 0, -0.085), (0.16, 0.02, 0.018, 0, -0.13), (0.06, 0.012, 0.012, 0, -0.14)], HAIR, n=8, sub=0)
    if hs == 'long': loft('head', [(0.2, 0.09, 0.07, 0, -0.04), (0.06, 0.1, 0.06, 0, -0.06), (-0.04, 0.085, 0.04, 0, -0.07)], HAIR, n=14, cap0=False, sub=0)
    if hs == 'wild': [sph('head', HAIR, (math.sin(a) * 0.08, 0.2 + 0.03 * math.cos(a * 3), math.cos(a) * 0.08 - 0.02), (0.04, 0.035, 0.04)) for a in [i * 0.9 for i in range(7)]]
    if hs == 'braids':
        for sx in (-1, 1): loft('head', [(0.12, 0.016, 0.016, sx * 0.075, -0.03), (0.0, 0.014, 0.014, sx * 0.08, 0.0), (-0.1, 0.01, 0.01, sx * 0.08, 0.02)], HAIR, n=8, sub=0)
    if k.get('beard'):
        B = col(k['beard']); sph('head', B, (0, 0.045, 0.055), (0.07, 0.08, 0.05)); prim('head', 'cone', B, (0, -0.02, 0.07), (0.035, 0.035, 0.08), rot=(math.pi * 0.95, 0, 0), vertices=7)
    if hat == 'headband':
        loft('head', [(0.155, 0.093, 0.103, 0, -0.006), (0.185, 0.094, 0.104, 0, -0.008)], TRIM, cap0=False, cap1=False, sub=0)
        for sx in (-1, 1): box('head', TRIM, (sx * 0.02, 0.12, -0.12), (0.012, 0.06, 0.004), rot=(0.3, 0, sx * 0.15))
    elif hat == 'jingasa': prim('head', 'cone', LACQ, (0, 0.262, 0), (0.21, 0.21, 0.04), rot=(-math.pi / 2, 0, 0), vertices=20); sph('head', GOLD, (0, 0.27, 0.1), (0.016, 0.016, 0.016), seg_n=6)
    elif hat == 'greathelm':
        loft('head', [(-0.01, 0.112, 0.118, 0, 0.004), (0.12, 0.116, 0.122, 0, 0.004), (0.25, 0.11, 0.115, 0, 0.004), (0.27, 0.06, 0.06, 0, 0)], STEEL, n=16, sub=0)
        box('head', col(0x070707), (0, 0.14, 0.12), (0.08, 0.006, 0.01)); box('head', GOLD, (0, 0.12, 0.124), (0.0065, 0.1, 0.004))
    elif hat == 'nasal':
        loft('head', [(0.12, 0.094, 0.104, 0, -0.002), (0.2, 0.088, 0.1, 0, -0.004), (0.26, 0.04, 0.05, 0, -0.004)], STEEL, n=16, cap0=False, sub=0)
        box('head', STEEL, (0, 0.125, 0.108), (0.009, 0.042, 0.007))
    elif hat == 'oni':
        loft('head', [(0.1, 0.098, 0.108, 0, -0.004), (0.2, 0.09, 0.1, 0, -0.006), (0.265, 0.05, 0.055, 0, -0.006)], LACQ, n=16, cap0=False, sub=0)
        for sx in (-1, 1): prim('head', 'cone', CREAM, (sx * 0.06, 0.29, 0.03), (0.022, 0.022, 0.07), rot=(-0.3, sx * 0.4, 0), vertices=7)
        box('head', GOLD, (0, 0.21, 0.1), (0.05, 0.012, 0.006))
    elif hat == 'mask': box('head', dk(TRIM, 1.2), (0, 0.045, 0.072), (0.07, 0.04, 0.03))
    # ---------------- bras
    sleeve = TOP if not (bare or fur) else SK
    if plate: sleeve = STEEL
    if robe:
        loft('uarm', [(0.03, 0.07, 0.07, 0, 0), (-0.06, 0.08, 0.085, 0, 0.004), (-0.18, 0.088, 0.1, 0, 0.01), (-0.27, 0.09, 0.115, 0, 0.018), (-0.3, 0.084, 0.118, 0, 0.02)], TOP, cap1=False)
    else:
        loft('uarm', [(0.03, 0.052, 0.052, 0, 0), (-0.07, 0.058, 0.058, 0, 0), (-0.15, 0.06, 0.06, 0, 0.004), (-0.24, 0.05, 0.05, 0, 0), (-0.29, 0.046, 0.046, 0, 0)], sleeve)
    if fur: loft('uarm', [(-0.14, 0.064, 0.064, 0, 0.004), (-0.17, 0.064, 0.064, 0, 0.004)], GOLD, cap0=False, cap1=False, sub=0)
    fac = SK if (bare or fur or robe or tid == 'bandit') else (STEEL if plate else TOP)
    def farm(x, y, z): return (TOP if y > -0.12 else SK) if robe else fac
    loft('farm', [(0.02, 0.048, 0.048, 0, 0), (-0.08, 0.048, 0.046, 0, 0), (-0.12, 0.044, 0.042, 0, 0), (-0.2, 0.038, 0.036, 0, 0), (-0.255, 0.031, 0.03, 0, 0)], farm, n=12)
    if robe: loft('farm', [(-0.1, 0.062, 0.07, 0, 0), (-0.14, 0.058, 0.066, 0, 0)], dk(TOP, 0.55), n=12, cap0=False, cap1=False, sub=0)
    HAND = col(0x4a4f55) if plate else (TOP if plain else SK)
    sph('farm', HAND, (0, -0.3, 0.008), (0.042, 0.05, 0.034), sub=1)
    for i in range(4): sph('farm', HAND, (0.026 - i * 0.017, -0.338, 0.024), (0.009, 0.014, 0.013), seg_n=6)
    sph('farm', HAND, (-0.03, -0.31, 0.032), (0.01, 0.022, 0.011), seg_n=6)
    if not plate and not plain:
        for y in (-0.21, -0.235): loft('farm', [(y, 0.038, 0.036, 0, 0), (y - 0.012, 0.037, 0.035, 0, 0)], LEATHER, n=12, cap0=False, cap1=False, sub=0)
    # ---------------- jambes
    def pleat(x, y, z): a = math.atan2(x, z); return dk(BOT, 0.72) if math.cos(a * 6) > 0.86 else BOT
    if hak:
        loft('thigh', [(0.04, 0.105, 0.105, 0, 0), (-0.12, 0.112, 0.112, 0, 0.003), (-0.3, 0.118, 0.12, 0, 0.006), (-0.45, 0.12, 0.122, 0, 0.008)], pleat, n=20, cap1=False)
        loft('shin', [(0.03, 0.118, 0.12, 0, 0.004), (-0.1, 0.116, 0.118, 0, 0.004), (-0.24, 0.11, 0.11, 0, 0.002), (-0.3, 0.098, 0.098, 0, 0)], pleat, n=20, cap0=False)
        loft('shin', [(-0.3, 0.06, 0.06, 0, 0), (-0.34, 0.048, 0.05, 0, 0), (-0.42, 0.044, 0.046, 0, 0)], CREAM, n=12, sub=0)
        for y in (-0.315, -0.355, -0.395): loft('shin', [(y, 0.05, 0.052, 0, 0), (y - 0.01, 0.049, 0.051, 0, 0)], ROPE, n=12, cap0=False, cap1=False, sub=0)
    else:
        lc = SK if kilt else (STEEL if plate else BOT)
        loft('thigh', [(0.03, 0.082, 0.082, 0, 0), (-0.1, 0.088, 0.088, 0, 0.004), (-0.25, 0.08, 0.08, 0, 0.004), (-0.44, 0.06, 0.062, 0, 0.006)], lc)
        sc_ = SK if (kilt or bare) else (STEEL if plate else BOT)
        loft('shin', [(0.02, 0.056, 0.058, 0, 0.004), (-0.12, 0.062, 0.066, 0, 0.01), (-0.3, 0.046, 0.048, 0, 0.004), (-0.42, 0.042, 0.044, 0, 0)], sc_)
        if kilt: loft('shin', [(-0.15, 0.064, 0.068, 0, 0.01), (-0.42, 0.046, 0.048, 0, 0)], col(0xb9b2a0), cap0=False, sub=0)
        if fur: loft('shin', [(-0.2, 0.072, 0.072, 0, 0), (-0.4, 0.066, 0.068, 0, 0)], FUR, cap0=False)
        if bare: [loft('shin', [(-0.33 - i * 0.03, 0.05, 0.05, 0, 0), (-0.35 - i * 0.03, 0.048, 0.048, 0, 0)], col(0x75674c), n=12, cap0=False, cap1=False, sub=0) for i in range(3)]
    # ---------------- pied
    if japan or hak:
        loft('foot', [(0.0, 0.042, 0.042, 0, 0), (-0.035, 0.046, 0.06, 0, 0.03), (-0.05, 0.045, 0.1, 0, 0.06)], SK if bare else CREAM, n=12)
        sph('foot', SK if bare else CREAM, (0, -0.045, 0.15), (0.042, 0.022, 0.05))
        box('foot', SOLE, (0, -0.068, 0.055), (0.05, 0.007, 0.13)); box('foot', ROPE, (0, -0.05, 0.11), (0.046, 0.006, 0.007), rot=(0.6, 0, 0))
    else:
        BC = col(0x4a4f55) if plate else (TOP if plain else col(0x2a1e15))
        loft('foot', [(0.02, 0.046, 0.046, 0, 0), (-0.03, 0.05, 0.065, 0, 0.03), (-0.06, 0.048, 0.1, 0, 0.06)], BC, n=12)
        sph('foot', BC, (0, -0.045, 0.15), (0.045, 0.026, 0.055)); box('foot', SOLE, (0, -0.07, 0.055), (0.05, 0.006, 0.13))
    return SEG

def dump(objs):
    dg = bpy.context.evaluated_depsgraph_get(); P, N, C, I, idx = [], [], [], [], {}
    for ob in objs:
        me = ob.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); cl = me.color_attributes[0].data
        for tri in me.loop_triangles:
            for li, vi in zip(tri.loops, tri.vertices):
                p = me.vertices[vi].co; n = me.corner_normals[li].vector; c = cl[li].color
                key = (round(p.x * 8000), round(p.y * 8000), round(p.z * 8000), round(n.x * 127), round(n.y * 127), round(n.z * 127), round(c[0] * 255), round(c[1] * 255), round(c[2] * 255))
                if key not in idx: idx[key] = len(P) // 3; P += key[0:3]; N += key[3:6]; C += key[6:9]
                I.append(idx[key])
    b = lambda a, f: base64.b64encode(struct.pack('<%d%s' % (len(a), f), *a)).decode()
    return '{ p: "%s", n: "%s", c: "%s", i: "%s" }' % (b(P, 'h'), b([max(-127, min(127, v)) for v in N], 'b'), b([max(0, min(255, v)) for v in C], 'B'), b(I, 'H')), len(I) // 3

out_parts, total = [], 0
for tid, k in LOOKS.items():
    SEG = build(k, tid); segs = []
    for seg in ('pelvis', 'chest', 'head', 'uarm', 'farm', 'thigh', 'shin', 'foot'):
        s, n = dump(SEG.get(seg, [])); segs.append('    %s: %s' % (seg, s)); total += n
    out_parts.append('  %s: {\n%s\n  }' % (tid, ',\n'.join(segs))); print(tid, 'ok')
dst = os.path.join(HERE, '..', 'src', 'js', '04c_perso.js')
open(dst, 'w').write("// ======================================================================\n// 04c — combattants modélisés dans Blender (blender/personnages.py). Ne pas éditer à la main : relancer le script.\n"
                     "// Par segment : positions (int16, 1/8000 m), normales (int8), couleurs (uint8), indices (uint16), en base64.\n"
                     "// ======================================================================\nconst BLENDER_FIGHTER = {\n" + ',\n'.join(out_parts) + "\n};\n")
print('total', total, 'triangles ->', os.path.getsize(dst), 'octets')
