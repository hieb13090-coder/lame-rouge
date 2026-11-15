# Katana modélisé dans Blender (bpy), exporté en tableaux pour le jeu.
# Repère du jeu : origine dans la main, +Y vers la pointe, tranchant vers +Z, épaisseur sur X.
# Lancer : python3 blender/katana.py  → écrit src/js/04a_blender.js
import bpy, bmesh, math, base64, struct, os
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
def col(h): return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)

def loft(name, sections, colors, cap0=True, cap1=True, smooth=False):
    """sections : liste d'anneaux de points (même nombre) ; colors : couleur par anneau (ou par point)."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); rings = []
    for ring in sections: rings.append([bm.verts.new(p) for p in ring])
    n = len(sections[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            try: bm.faces.new((a[i], a[j], b[j], b[i]))
            except ValueError: pass
    if cap0: bm.faces.new(list(reversed(rings[0])))
    if cap1:
        try: bm.faces.new(rings[-1])
        except ValueError: pass
    lay = bm.loops.layers.color.new('col')
    vi = {}
    for ri, ring in enumerate(rings):
        for pi, v in enumerate(ring): vi[v] = (ri, pi)
    for f in bm.faces:
        for l in f.loops:
            ri, pi = vi[l.vert]; c = colors(ri, pi) if callable(colors) else colors[ri]
            l[lay] = (*c, 1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = smooth
    return ob

# ---------- lame : section hexagonale (mune, shinogi, tranchant), courbure vers le dos, kissaki
y0, y1, kis = 0.088, 0.80, 0.065
steps = 40; secs = []
for s in range(steps + 1):
    t = s / steps; y = y0 + (y1 - y0) * t
    sori = -0.045 * t * t                                   # le dos se creuse vers -Z
    w = 0.031 - 0.006 * t
    if y > y1 - kis:                                         # pointe : le tranchant remonte vers le dos
        k = (y - (y1 - kis)) / kis; w *= math.sqrt(max(0.0, 1 - k * k)) * 0.98 + 0.002
    th = 0.0036 * (1 - 0.35 * t)
    zs = sori - 0.0155 + (0.031 - w) * 0.5                   # dos
    ze = zs + w                                              # tranchant
    zr = zs + 0.32 * w                                       # arête (shinogi)
    secs.append([(0, y, zs - 0.0006), (th * 0.75, y, zs + 0.0015), (th, y, zr), (0.0005, y, ze),
                 (-0.0005, y, ze), (-th, y, zr), (-th * 0.75, y, zs + 0.0015)])
def blade_col(ri, pi):
    if pi in (3, 4): return col(0xf4f7fa)                    # fil
    if pi in (2, 5): return col(0xcfd6de)                    # arête
    return col(0x9aa3ad)                                     # dos et flancs
loft('blade', secs, blade_col)

# ---------- habaki (collet doré)
hb = []
for y in (0.062, 0.09):
    r = []
    for i in range(12):
        a = 2 * math.pi * i / 12; r.append((0.0075 * math.cos(a), y, -0.0002 + 0.019 * math.sin(a)))
    hb.append(r)
loft('habaki', hb, [col(0xc9a03a)] * 2, smooth=True)

# ---------- tsuba (garde ajourée en fleur)
ts = []
for y in (0.052, 0.06):
    r = []
    for i in range(40):
        a = 2 * math.pi * i / 40; R = 0.047 + 0.004 * math.cos(4 * a)
        r.append((R * math.cos(a) * 0.95, y, R * math.sin(a)))
    ts.append(r)
loft('tsuba', ts, [col(0x2b2a2f), col(0x3a3840)], smooth=True)
for y, h in ((0.05, 0.003), (0.062, 0.003)):                 # seppa : rondelles dorées
    sp = [[(0.012 * math.cos(2 * math.pi * i / 16), y + d, 0.024 * math.sin(2 * math.pi * i / 16)) for i in range(16)] for d in (0, h)]
    loft('seppa', sp, [col(0xb8902c)] * 2, smooth=True)

# ---------- tsuka : poignée ovale, tressage en losanges (relief + couleurs alternées)
tk = []; Ny, Na = 36, 16
for s in range(Ny + 1):
    t = s / Ny; y = 0.05 - 0.27 * t
    r = []
    for i in range(Na):
        a = 2 * math.pi * i / Na
        u = (t * 9 + a / math.pi) % 1; v = (t * 9 - a / math.pi) % 1
        bump = 0.0016 * max(abs(u - 0.5), abs(v - 0.5)) * 2      # losanges du tressage
        rx, rz = 0.0125 + bump, 0.0165 + bump
        r.append((rx * math.cos(a), y, rz * math.sin(a)))
    tk.append(r)
def tsuka_col(ri, pi):
    t = ri / Ny; a = 2 * math.pi * pi / Na
    u = (t * 9 + a / math.pi) % 1; v = (t * 9 - a / math.pi) % 1
    return col(0xe8dfc8) if min(abs(u - 0.5), abs(v - 0.5)) < 0.12 else col(0x17141c)   # galuchat clair entre les tresses noires
loft('tsuka', tk, tsuka_col, smooth=True)
ka = [[((0.0135 - 0.002 * d) * math.cos(2 * math.pi * i / 16), -0.22 - d * 0.018, (0.0175 - 0.003 * d) * math.sin(2 * math.pi * i / 16)) for i in range(16)] for d in (0, 1)]
loft('kashira', ka, [col(0xb8902c), col(0x8e6c1e)], smooth=True)

# ---------- export : triangles, normales et couleurs, en deux groupes (lame métal / monture)
def dump(names):
    P, N, C = [], [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or not any(ob.name.startswith(n) for n in names): continue
        me = ob.evaluated_get(dg).to_mesh(); me.calc_loop_triangles()
        cl = me.color_attributes[0].data if me.color_attributes else None
        for tri in me.loop_triangles:
            for li, vi in zip(tri.loops, tri.vertices):
                p = me.vertices[vi].co; P += [p.x, p.y, p.z]
                n = me.corner_normals[li].vector if tri.use_smooth else tri.normal; N += [n.x, n.y, n.z]
                c = cl[li].color if cl else (1, 1, 1, 1); C += [c[0], c[1], c[2]]
    b64 = lambda a: base64.b64encode(struct.pack('<%df' % len(a), *a)).decode()
    return '{ p: "%s", n: "%s", c: "%s" }' % (b64(P), b64(N), b64(C)), len(P) // 9
blade, nb = dump(['blade']); hilt, nh = dump(['habaki', 'tsuba', 'seppa', 'tsuka', 'kashira'])
out = os.path.join(os.path.dirname(__file__), '..', 'src', 'js', '04a_blender.js')
open(out, 'w').write(
"// ======================================================================\n"
"// 04a — modèles faits dans Blender (blender/*.py), exportés en tableaux. Ne pas éditer à la main : relancer le script.\n"
"// ======================================================================\n"
"const BLENDER = {\n  katana: { blade: %s, hilt: %s },\n};\n" % (blade, hilt))
print('katana : lame %d triangles, monture %d triangles' % (nb, nh))
