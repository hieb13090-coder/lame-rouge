import sys; sys.path.insert(0, '/home/claude/blender')
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix, Euler
import greave as G
from greave import V, sec, TAU, BUL, bul, PL_TOP, PL_BOT, plate_hw

# ---------------------------------------------------------------- scène propre
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
col = sc.collection

def mat(name, base, metal=0.0, rough=0.5, coat=0.0, emit=None, strength=0.0, alpha=1.0, double=True):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    m.use_backface_culling = False
    return m

M_ARM = mat('armure_noire', (0.012, 0.012, 0.016), 1.0, 0.24, 1.0)
M_CHR = mat('chrome_sombre', (0.42, 0.44, 0.48), 1.0, 0.14, 0.5)
M_INT = mat('interieur', (0.008, 0.008, 0.01), 0.2, 0.85)
M_NICHE = mat('niche', (0.015, 0.016, 0.02), 0.9, 0.38)
M_GLOW = mat('lueur_bleue', (0.1, 0.35, 0.8), 0, 0.3, emit=(0.25, 0.65, 1.0), strength=7.0)
M_FLAME = mat('flamme', (0.3, 0.7, 1.0), 0, 0.5, emit=(0.3, 0.7, 1.0), strength=10.0, alpha=0.85)
M_CORE = mat('flamme_coeur', (0.9, 0.97, 1.0), 0, 0.5, emit=(0.85, 0.95, 1.0), strength=18.0)
M_SKIN = mat('jambe_controle', (0.55, 0.38, 0.30), 0, 0.6, alpha=0.5)

def link(o, parent=None):
    col.objects.link(o)
    if parent is not None: o.parent = parent
    return o

def obj_from_bm(name, bm, m, parent=None, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); o.data.materials.append(m); return link(o, parent)

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.2; e.location = loc; return link(e, parent)

# ---------------------------------------------------------------- coque + jambe de contrôle
shell = bpy.data.objects.new('jambiere_coque', G.build_shell())
shell.data.materials.append(M_ARM)
for p in shell.data.polygons: p.use_smooth = True
link(shell)
# intérieur en matériau sombre : faces dont la normale pointe vers l'axe (cavité)
bm = bmesh.new(); bm.from_mesh(shell.data)
shell.data.materials.append(M_INT)
for f in bm.faces:
    c = f.calc_center_median(); n = f.normal
    if c.z > G.FLOOR - 1e-3 and c.z < 10.5:
        # point de la cavité : on teste si le centre est proche de la surface intérieure
        y = c.z; zz = -c.y
        a, b, cc = sec(y, inner=True)
        r = math.hypot(c.x / max(a, 1e-3), (zz - cc) / max(b, 1e-3))
        if abs(r - 1) < 0.035 or (f.material_index == 0 and y < G.FLOOR + 0.01):
            f.material_index = 1
bm.to_mesh(shell.data); bm.free()

leg = bpy.data.objects.new('jambe_controle', G.build_leg()); leg.data.materials.append(M_SKIN)
for p in leg.data.polygons: p.use_smooth = True
link(leg)

# ---------------------------------------------------------------- géométrie utilitaire
def rear_z(y):
    a, b, c = sec(y); return c - b          # arrière du fût (z jeu), au centre x=0

def cyl(name, r0, r1, y_top, y_bot, xc, off, parent, m, seg=40, caps=True):
    """cylindre/cône vertical (axe y) : rayon r0 en haut, r1 en bas, centre à z = rear_z + off(y)"""
    bm = bmesh.new(); rings = []
    n = 14
    for k in range(n + 1):
        t = k / n; y = y_top + (y_bot - y_top) * t; r = r0 + (r1 - r0) * t
        zc = rear_z(y) + off
        rings.append([bm.verts.new(V(xc + r * math.sin(TAU * s / seg), y, zc + r * math.cos(TAU * s / seg))) for s in range(seg)])
    for j in range(n):
        for s in range(seg):
            bm.faces.new([rings[j][s], rings[j][(s + 1) % seg], rings[j + 1][(s + 1) % seg], rings[j + 1][s]])
    if caps:
        for ring in (rings[0], rings[-1]):
            bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, m, parent)

def ring_band(name, r, tube, y, xc, off, parent, m):
    bm = bmesh.new()
    bmesh.ops.create_torus if False else None
    seg, tseg = 48, 10
    zc = rear_z(y) + off
    rg = []
    for i in range(seg):
        a = TAU * i / seg; cx, cz = xc + r * math.sin(a), zc + r * math.cos(a)
        ring = []
        for j in range(tseg):
            t = TAU * j / tseg
            rr = r + tube * math.cos(t)
            ring.append(bm.verts.new(V(xc + rr * math.sin(a), y + tube * math.sin(t), zc + rr * math.cos(a))))
        rg.append(ring)
    for i in range(seg):
        for j in range(tseg):
            bm.faces.new([rg[i][j], rg[i][(j + 1) % tseg], rg[(i + 1) % seg][(j + 1) % tseg], rg[(i + 1) % seg][j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, m, parent)

def bell(name, r_in, r_out, length, parent, m):
    """buse : cloche en révolution autour de Z local, ouverture vers -Z (le bas)"""
    bm = bmesh.new(); seg = 48; prof = []
    for k in range(9):
        t = k / 8; z = -length * t; r = r_in + (r_out - r_in) * (t ** 1.6)
        prof.append((r, z))
    prof.append((r_out * 0.86, -length))        # épaisseur de la lèvre
    for k in range(8, -1, -1):
        t = k / 8; z = -length * t; r = (r_in + (r_out - r_in) * (t ** 1.6)) * 0.86
        prof.append((r, z + 0.0))
    rings = [[bm.verts.new(Vector((r * math.sin(TAU * s / seg), r * math.cos(TAU * s / seg), z))) for s in range(seg)] for r, z in prof]
    for j in range(len(rings) - 1):
        for s in range(seg):
            bm.faces.new([rings[j][s], rings[j][(s + 1) % seg], rings[j + 1][(s + 1) % seg], rings[j + 1][s]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, m, parent)

def cone_down(name, r, length, parent, m, seg=32):
    bm = bmesh.new(); prof = [(0.001, 0.0), (r * 0.95, 0.0), (r, -0.12 * length), (r * 0.78, -0.35 * length), (r * 0.4, -0.68 * length), (0.001, -length)]
    rings = []
    for rr, z in prof:
        rings.append([bm.verts.new(Vector((rr * math.sin(TAU * s / seg), rr * math.cos(TAU * s / seg), z))) for s in range(seg)])
    for j in range(len(rings) - 1):
        for s in range(seg):
            bm.faces.new([rings[j][s], rings[j][(s + 1) % seg], rings[j + 1][(s + 1) % seg], rings[j + 1][s]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, m, parent)

# ---------------------------------------------------------------- réacteur arrière (caché sous la plaque)
reactor = empty('reacteur_arriere')
slope = (rear_z(8.5) - rear_z(4.6)) / 3.9
modules = []    # (nom, xc, r, y_haut, y_bas)
modules.append(('principal', 0.0, 0.25, 8.55, 5.0, 0.15))
modules.append(('lateral_g', -0.45, 0.13, 8.35, 5.7, 0.085))
modules.append(('lateral_d', 0.45, 0.13, 8.35, 5.7, 0.085))
nozzles = []
for name, xc, r, yt, yb, rb in modules:
    off = -(r + 0.05)
    cyl('tube_' + name, r, rb, yt, yb, xc, off, reactor, M_CHR)
    for k in range(1, 6):
        y = yt + (yb - yt) * k / 6
        ring_band('anneau_%s_%d' % (name, k), r + (rb - r) * k / 6, 0.016, y, xc, off, reactor, M_ARM)
    cyl('coeur_' + name, r * 0.5, rb * 0.5, yt - 0.2, yb + 0.25, xc, off - r * 0.2, reactor, M_GLOW, seg=16)
    r = rb
    # buse : empty à l'embouchure, la cloche sort vers le bas à l'ouverture
    ey = yb; ez = rear_z(ey) + off
    nz = empty('buse_' + name, tuple(V(xc, ey, ez)), reactor)
    nz.rotation_euler = (math.atan(slope) + 0.22, 0, 0)
    b = bell('cloche_' + name, r * 0.55, r * 1.12, 0.95 * (r / 0.33) ** 0.6, nz, M_CHR)
    lip = ring_band('levre_' + name, r * 1.1, 0.02, 0.0, 0, 0, nz, M_ARM)  # placé à l'origine puis déplacé
    lip.location = (0, 0, -0.95 * (r / 0.33) ** 0.6 + 0.0); lip.rotation_euler = (0, 0, 0)
    # on remet la lèvre dans le repère local (ring_band utilise rear_z) : on la supprime pour rester propre
    bpy.data.objects.remove(lip, do_unlink=True)
    fl = cone_down('flamme_' + name, r * 0.95, 4.4 * (r / 0.33) ** 0.8, nz, M_FLAME)
    fl.location = (0, 0, -0.95 * (r / 0.33) ** 0.6)
    cr = cone_down('flamme_coeur_' + name, r * 0.5, 2.9 * (r / 0.33) ** 0.8, nz, M_CORE)
    cr.location = (0, 0, -0.95 * (r / 0.33) ** 0.6)
    nozzles.append((nz, fl, cr, name))

# fentes lumineuses sur le fond de la niche
bm = bmesh.new()
for k in range(16):
    y = 8.6 - k * 0.27
    hw = plate_hw(y) - 0.12
    zr = rear_z(y) - 0.015
    x0, x1 = -hw, hw
    bm.faces.new([bm.verts.new(V(x0, y, zr)), bm.verts.new(V(x1, y, zr)), bm.verts.new(V(x1, y - 0.035, zr)), bm.verts.new(V(x0, y - 0.035, zr))])
slits = obj_from_bm('fentes_niche', bm, M_GLOW, reactor, smooth=False)

# ---------------------------------------------------------------- plaque articulée
def base_xz(x, y):
    """point sur la surface arrière de base pour un x donné (z jeu) + normale"""
    a, b, c = sec(y); sh = G.shrink(y)
    e = 2.0 / (2.0 + 0.9 * G.sm((2.8 - y) / 1.6))
    d = G.relief(y, -1.0, 0.0)
    aa = (a + d) * sh; bb = (b + d) * sh
    sn = math.copysign(min(0.995, (abs(x) / aa) ** (1 / e)), x)
    phi = math.atan2(sn, -math.sqrt(1 - sn * sn))
    px, pz = G.outer_point(y, phi, base_only=True)
    nx, nz = px / (a * a), (pz - c) / (b * b); nl = math.hypot(nx, nz) or 1.0
    return px, pz, nx / nl, nz / nl

def plate_grid(off_out, relative, gap=0.03):
    ys = np.linspace(PL_TOP - gap, PL_BOT + gap, 46); rows = []
    for y in ys:
        hw = plate_hw(y) - gap; row = []
        for xv in np.linspace(-hw, hw, 22):
            px, pz, nx, nz = base_xz(xv, y)
            o = off_out + bul(y)
            row.append((px + nx * o, y, pz + nz * o))
        rows.append(row)
    return rows

hinge_pt = None
def build_plate():
    global hinge_pt
    outer = plate_grid(0.0, True); inner = plate_grid(-0.14, True)
    hx, hy, hz = 0.0, outer[0][11][1], outer[0][11][2]
    hinge_pt = (hx, hy, hz)
    bm = bmesh.new()
    def add(grid):
        return [[bm.verts.new(V(p[0] - hx, p[1] - hy, p[2] - hz)) for p in row] for row in grid]
    vo, vi = add(outer), add(inner)
    R, C = len(vo), len(vo[0])
    for j in range(R - 1):
        for i in range(C - 1):
            bm.faces.new([vo[j][i], vo[j][i + 1], vo[j + 1][i + 1], vo[j + 1][i]])
            bm.faces.new([vi[j][i], vi[j + 1][i], vi[j + 1][i + 1], vi[j][i + 1]])
    for i in range(C - 1):
        bm.faces.new([vo[0][i], vi[0][i], vi[0][i + 1], vo[0][i + 1]])
        bm.faces.new([vo[-1][i], vo[-1][i + 1], vi[-1][i + 1], vi[-1][i]])
    for j in range(R - 1):
        bm.faces.new([vo[j][0], vo[j + 1][0], vi[j + 1][0], vi[j][0]])
        bm.faces.new([vo[j][-1], vi[j][-1], vi[j + 1][-1], vo[j + 1][-1]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm
plate_bm = build_plate()
pivot = empty('plaque_arriere_pivot', tuple(V(*hinge_pt)))
plate = obj_from_bm('plaque_arriere', plate_bm, M_ARM, pivot)
bev = plate.modifiers.new('chanfrein', 'BEVEL'); bev.width = 0.018; bev.segments = 2; bev.limit_method = 'ANGLE'

# ---------------------------------------------------------------- animation (images 1 -> 40)
sc.frame_start, sc.frame_end = 1, 40
OPEN = math.radians(24)
def key(o, path, idx, frame, val):
    o.keyframe_insert(path, index=idx, frame=frame)
pivot.rotation_euler = (0, 0, 0); pivot.keyframe_insert('rotation_euler', index=0, frame=1)
pivot.rotation_euler = (OPEN, 0, 0); pivot.keyframe_insert('rotation_euler', index=0, frame=20)
for nz, fl, cr, name in nozzles:
    for o in (fl, cr):
        o.scale = (0.001, 0.001, 0.001); o.keyframe_insert('scale', frame=1); o.keyframe_insert('scale', frame=24)
        o.scale = (1, 1, 1); o.keyframe_insert('scale', frame=32)
    # la buse est rentrée dans le tube à l'état fermé
    nz.scale = (1, 1, 0.02); nz.keyframe_insert('scale', frame=1); nz.keyframe_insert('scale', frame=10)
    nz.scale = (1, 1, 1); nz.keyframe_insert('scale', frame=24)
for ob in bpy.data.objects:
    if ob.animation_data and ob.animation_data.action:
        for fc in ob.animation_data.action.fcurves if hasattr(ob.animation_data.action, 'fcurves') else []:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'

def set_state(frame):
    sc.frame_set(frame)
