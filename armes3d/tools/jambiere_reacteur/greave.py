"""Jambière creuse (jambe + pied) avec réacteur arrière caché sous une plaque.
Repère de calcul = repère du jeu (x droite, y haut, z avant). Blender : (X, Y, Z) = (x, -z, y).
Unité u : 1 u = S_CM centimètres (hauteur de la botte = 10 u).
"""
import bpy, bmesh, json, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

D = json.load(open('/home/claude/blender/ref.json'))
ROWS = np.array(D['rows']); PLATE = np.array(D['plate']); CUT = D['cut']
S_CM = 4.6          # centimètres par unité
T = 0.16            # épaisseur de coque (u) ~ 0,7 cm
FLOOR = 0.45        # épaisseur de semelle (u) ~ 2 cm
MARGIN = 0.05       # jeu autour de la jambe (u) ~ 2 mm
N = 240             # points par anneau
TAU = math.pi * 2


def sm(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)

def V(x, y, z):  # repère jeu -> Blender
    return Vector((x, -z, y))

def cut_y(z):
    return CUT['icpt'] + CUT['slope'] * z

# ---------------------------------------------------------------- jambe humaine (cm)
# h = hauteur au-dessus de la semelle intérieure ; L = demi-longueur (z), W = demi-largeur (x), zc = centre z depuis l'arrière du talon
LEG = np.array([
    [0.0, 13.0, 4.6, 13.0], [2.5, 12.4, 4.6, 12.6], [5.0, 9.4, 4.3, 9.6], [8.0, 5.9, 3.9, 6.0],
    [11.0, 5.2, 3.7, 5.6], [20.0, 4.5, 3.7, 5.4], [30.0, 5.4, 5.0, 5.2], [38.0, 5.3, 4.9, 5.2], [46.0, 5.0, 4.6, 5.2]])

def leg_sec(h):
    return [float(np.interp(h, LEG[:, 0], LEG[:, k])) for k in (1, 2, 3)]  # L, W, zc

# ---------------------------------------------------------------- sections de la coque
YG = np.arange(0, 10.0001, 0.05)
A0 = np.interp(YG, ROWS[:, 0], ROWS[:, 1]); B0 = np.interp(YG, ROWS[:, 0], ROWS[:, 2]); C0 = np.interp(YG, ROWS[:, 0], ROWS[:, 3])

def blur(a, w):
    k = np.ones(w) / w; p = np.pad(a, w // 2, mode='edge'); return np.convolve(p, k, mode='valid')

A0, B0, C0 = blur(A0, 5), blur(B0, 5), blur(C0, 5)
BACK = float((C0 - B0)[int(0.6 / 0.05)])      # arrière du talon (u)
Z0 = BACK + T + MARGIN                       # talon de la jambe
FOOT_FRONT = Z0 + 26.5 / S_CM + MARGIN + T + 0.14
EXT = FOOT_FRONT - float((C0 + B0)[int(0.6 / 0.05)])
w_ext = np.array([sm((2.9 - y) / 2.0) for y in YG])
B1 = B0 + 0.5 * EXT * w_ext; C1 = C0 + 0.5 * EXT * w_ext      # pointe allongée vers l'avant

def fit(margin):
    A, B, C = A0.copy(), B1.copy(), C1.copy()
    for i, y in enumerate(YG):
        h = (y - FLOOR) * S_CM
        if h < 0 or y > 10.05:
            continue
        L, W, zc = leg_sec(h)
        Wu, Lu, zu = W / S_CM, L / S_CM, Z0 + zc / S_CM
        A[i] = max(A[i], Wu + margin + T)
        lo = min(C[i] - B[i], zu - Lu - margin - T); hi = max(C[i] + B[i], zu + Lu + margin + T)
        B[i] = (hi - lo) / 2; C[i] = (hi + lo) / 2
    return A, B, C

def fitted(margin):
    A, B, C = fit(margin)
    A, B, C = blur(A, 7), blur(B, 7), blur(C, 7)
    A, B, C = np.maximum(A, A0), B, C
    A2, B2, C2 = fit(margin)               # reprise : on ne descend jamais sous le besoin
    lo = np.minimum(C - B, C2 - B2); hi = np.maximum(C + B, C2 + B2)
    return np.maximum(A, A2), (hi - lo) / 2, (hi + lo) / 2

AF, BF, CF = fitted(MARGIN + 0.02)

def sec(y, inner=False):
    a = float(np.interp(y, YG, AF)); b = float(np.interp(y, YG, BF)); c = float(np.interp(y, YG, CF))
    return (a - T, b - T, c) if inner else (a, b, c)

def shrink(y):  # arrondi de l'arête de semelle (extérieur)
    h = 0.30
    return 1.0 if y >= h else 0.72 + 0.28 * math.sqrt(max(0.0, 1 - ((h - y) / h) ** 2))

def bump(y, y0, w):
    d = abs(y - y0) / w
    return 0.5 * (1 + math.cos(math.pi * d)) if d < 1 else 0.0

# ---------------------------------------------------------------- relief « armure »
def relief(y, cs, sn):
    d = 0.0
    for y0 in (2.50, 2.66, 2.82):              # articulation de cheville (soufflet)
        d -= 0.030 * bump(y, y0, 0.05)
    d -= 0.030 * bump(y, 0.46, 0.04)           # joint de semelle
    d += 0.060 * bump(y, 8.95, 0.22)           # collier de genou
    d -= 0.032 * bump(y, 8.62, 0.035)
    d -= 0.032 * bump(y, 3.18, 0.035)          # bague basse du fût
    if cs > 0:                                 # arête de tibia
        d += 0.075 * (cs ** 8) * sm((y - 3.3) / 0.7) * sm((8.7 - y) / 0.7)
    if 3.4 < y < 8.6:                          # joints latéraux
        d -= 0.026 * math.exp(-((abs(sn) - 0.985) / 0.02) ** 2) if abs(sn) > 0.9 else 0
    return d

# ---------------------------------------------------------------- plaque arrière
PL_TOP, PL_BOT = 8.95, 3.55
PL_HW = np.interp(np.linspace(PL_TOP, PL_BOT, 12), np.linspace(PL_TOP, PL_BOT, len(PLATE)), (PLATE[:, 2] - PLATE[:, 1]) / 2)
def plate_hw(y):
    return float(np.interp(y, np.linspace(PL_BOT, PL_TOP, 12), PL_HW[::-1]))

BUL_TOP = 0.80  # saillie du carter arrière en haut (u) ~ 3,7 cm
BUL_BOT = 0.06  # saillie en bas : le carter se fond dans le mollet
BUL = BUL_TOP
FRAME = 0.18    # largeur du cadre autour de la plaque
def bul(y):
    return BUL_BOT + (BUL_TOP - BUL_BOT) * sm((y - PL_BOT - 0.4) / 1.5)

def dist_in(x, y):  # >0 dans la plaque, <0 dehors
    return min(plate_hw(y) - abs(x), y - PL_BOT, PL_TOP - y)

def rear_disp(x, y, rearness):
    """déplacement vers l'extérieur du carter arrière (cadre en relief, niche au centre)"""
    d = dist_in(x, y)
    dside = min(plate_hw(y) - abs(x), PL_TOP - y)
    frame = sm((dside + FRAME) / 0.14) * sm((y - (PL_BOT - FRAME - 1.1)) / 1.3)
    niche = 1.0 - sm(d / 0.035)
    return bul(y) * frame * niche * sm((rearness - 0.1) / 0.5)

def outer_point(y, phi, base_only=False):
    a, b, c = sec(y)
    sn, cs = math.sin(phi), math.cos(phi)
    sh = shrink(y)
    p = 2.0 / (2.0 / 1.0 + 0.0)
    e = 2.0 / (2.0 + 0.9 * sm((2.8 - y) / 1.6))
    d = relief(y, cs, sn)
    aa, bb = (a + d) * sh, (b + d) * sh
    x = aa * math.copysign(abs(sn) ** e, sn); z = c + bb * math.copysign(abs(cs) ** e, cs)
    if not base_only and y > PL_BOT - 0.4 and y < PL_TOP + 0.4 and cs < 0:
        r = rear_disp(x, y, -cs)
        if r > 1e-5:
            nx, nz = x / (a * a), (z - c) / (b * b); nl = math.hypot(nx, nz) or 1.0
            x += nx / nl * r; z += nz / nl * r
    return x, z

def inner_point(y, phi):
    a, b, c = sec(y, inner=True)
    sn, cs = math.sin(phi), math.cos(phi)
    e = 2.0 / (2.0 + 0.9 * sm((2.8 - y) / 1.6))
    return a * math.copysign(abs(sn) ** e, sn), c + b * math.copysign(abs(cs) ** e, cs)

# ---------------------------------------------------------------- maillage de la coque
def ring_ys_outer():
    ys = [0.0, 0.02, 0.05, 0.09, 0.14, 0.2, 0.27, 0.35]
    y = 0.42
    while y < 10.2:
        step = 0.03 if (PL_BOT - 0.3 < y < PL_TOP + 0.3) or (8.4 < y < 9.2) or (2.3 < y < 3.3) else 0.06
        ys.append(round(y, 4)); y += step
    return ys

def build_shell():
    bm = bmesh.new()
    def column_rings(ys, pt):
        grid = []
        done = [None] * (N + 1)
        for y in ys:
            row = []
            for s in range(N + 1):
                if done[s] is not None:
                    row.append(done[s]); continue
                x, z = pt(y, TAU * (s % N) / N)
                cy = cut_y(z)
                if y >= cy:
                    P = (x, cy, z); done[s] = P; row.append(P)
                else:
                    row.append((x, y, z))
            grid.append(row)
        return grid
    ys_o = ring_ys_outer()
    ys_i = [FLOOR] + [y for y in ys_o if y > FLOOR + 0.02]
    go = column_rings(ys_o, lambda y, phi: outer_point(y, phi))
    gi = column_rings(ys_i, lambda y, phi: inner_point(y, phi))
    def add(grid):
        idx = []
        for row in grid:
            r = []
            for (x, y, z) in row[:N]:
                r.append(bm.verts.new(V(x, y, z)))
            r.append(r[0]); idx.append(r)
        return idx
    vo, vi = add(go), add(gi)
    def strip(idx):
        for j in range(len(idx) - 1):
            for s in range(N):
                vs = [idx[j][s], idx[j][s + 1], idx[j + 1][s + 1], idx[j + 1][s]]
                if len(set(vs)) >= 3:
                    try: bm.faces.new(vs)
                    except ValueError: pass
    strip(vo); strip(vi)
    # lèvre : relie l'anneau supérieur extérieur et intérieur
    for s in range(N):
        vs = [vo[-1][s], vo[-1][s + 1], vi[-1][s + 1], vi[-1][s]]
        if len(set(vs)) >= 3:
            try: bm.faces.new(vs)
            except ValueError: pass
    # fonds
    co = bm.verts.new(V(0, 0, float(sec(0)[2]))); ci = bm.verts.new(V(0, FLOOR, float(sec(FLOOR, True)[2])))
    for s in range(N):
        bm.faces.new([co, vo[0][s + 1], vo[0][s]]); bm.faces.new([ci, vi[0][s], vi[0][s + 1]])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('coque'); bm.to_mesh(me); bm.free()
    return me

# ---------------------------------------------------------------- jambe de contrôle
def build_leg():
    bm = bmesh.new(); rings = []
    hs = list(np.arange(0, 46.01, 1.0))
    for h in hs:
        L, W, zc = leg_sec(h)
        r = []
        for s in range(48):
            phi = TAU * s / 48; sn, cs = math.sin(phi), math.cos(phi)
            e = 2 / 2.3 if h < 9 else 1.0
            x = W * math.copysign(abs(sn) ** e, sn); z = zc + L * math.copysign(abs(cs) ** e, cs)
            r.append(bm.verts.new(V(x / S_CM, FLOOR + h / S_CM, Z0 + z / S_CM)))
        rings.append(r)
    for j in range(len(rings) - 1):
        for s in range(48):
            bm.faces.new([rings[j][s], rings[j][(s + 1) % 48], rings[j + 1][(s + 1) % 48], rings[j + 1][s]])
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / 48)
        for s in range(48):
            bm.faces.new([c, ring[(s + 1) % 48], ring[s]] if flip else [c, ring[s], ring[(s + 1) % 48]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('jambe'); bm.to_mesh(me); bm.free()
    return me

def fit_report(shell_obj, leg_obj):
    """nombre de sommets de la jambe qui sortent de la cavité + pénétration max (cm)"""
    dg = bpy.context.evaluated_depsgraph_get()
    bv = BVHTree.FromObject(shell_obj, dg)
    bad, worst = 0, 0.0
    for v in leg_obj.data.vertices:
        p = v.co
        if p.z > cut_y(-p.y) - 0.02:       # au-dessus du col : hors de la coque
            continue
        # parité de rayons dans 3 directions : dedans si impair
        votes = 0
        for d in (Vector((1, 0.13, 0.07)), Vector((0, 1, 0.11)), Vector((-0.2, -1, 0.05))):
            d.normalize(); n = 0; o = p.copy()
            for _ in range(40):
                hit = bv.ray_cast(o, d)
                if hit[0] is None: break
                n += 1; o = hit[0] + d * 1e-4
            votes += n % 2
        if votes < 2:
            bad += 1
            loc, nor, i, dist = bv.find_nearest(p)
            worst = max(worst, dist * S_CM)
    return bad, worst


def fit_report2(margin_u=0.0):
    """test analytique : chaque sommet de la jambe doit être dans le polygone de la cavité à sa hauteur"""
    from matplotlib.path import Path
    bad, worst, tot = 0, 0.0, 0
    for v in bpy.data.objects['jambe'].data.vertices:
        x, y, z = v.co.x, v.co.z, -v.co.y
        if y > cut_y(z) - 0.02 or y < FLOOR - 1e-6:
            continue
        tot += 1
        poly = np.array([inner_point(y, TAU * s / 240) for s in range(240)])
        pth = Path(poly)
        if not pth.contains_point((x, z), radius=-margin_u):
            bad += 1
            d = np.min(np.hypot(poly[:, 0] - x, poly[:, 1] - z)); worst = max(worst, d * S_CM)
    return bad, tot, worst
