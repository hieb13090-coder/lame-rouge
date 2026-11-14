"""Personnage de test « Ronin » (1,80 m) : maillage + squelette + animations + points d'accroche d'effets -> GLB.

Sert d'exemple pour brancher les effets (fumée, auras élémentaires, impacts) et les armes dans le moteur.
- Squelette : Root, Hips, Spine, Chest, Neck, Head, Shoulder/UpperArm/LowerArm/Hand _L/_R, Thigh/Shin/Foot _L/_R.
- Animations : Idle (garde, respiration, 2 s en boucle), Punch_R (direct du droit, 0,8 s).
- Points d'accroche (nœuds vides parentés aux os) : FX_Hand_R, FX_Hand_L, FX_Weapon_R, FX_Weapon_L, FX_Chest, FX_Head,
  FX_Foot_R, FX_Foot_L, FX_Aura (au sol).
Repère GLB : Y vers le haut, mètres, le personnage regarde vers +Z, origine entre les pieds au sol.
Usage : python3 gen_character.py <dossier_glb> [dossier_previews]
"""
import math
import sys
from pathlib import Path

import bpy
import bmesh  # noqa: E402  (disponible une fois bpy importé)
import numpy as np
from mathutils import Matrix, Quaternion, Vector

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
PREV = Path(sys.argv[2]) if len(sys.argv) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def activate(o):
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def mat(name, rgb, rough, metal=0.0, coat=0.0, emis=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if emis:
        b.inputs["Emission Color"].default_value = (*emis, 1)
        b.inputs["Emission Strength"].default_value = 4.0
    return m


M = dict(cloth=mat("ronin_cloth", (0.020, 0.026, 0.055), 0.85),
         wrap=mat("ronin_wrap", (0.030, 0.022, 0.018), 0.70),
         skin=mat("ronin_skin", (0.56, 0.38, 0.29), 0.55),
         lacquer=mat("ronin_lacquer", (0.30, 0.012, 0.014), 0.32, coat=0.6),
         steel=mat("ronin_steel", (0.42, 0.43, 0.46), 0.30, metal=1.0),
         gold=mat("ronin_gold", (0.80, 0.56, 0.20), 0.30, metal=1.0),
         hair=mat("ronin_hair", (0.012, 0.010, 0.010), 0.50),
         sash=mat("ronin_sash", (0.55, 0.04, 0.04), 0.75))
MAT_ORDER = list(M)

# ---------------------------------------------------------------- squelette
BONES = [  # nom, tête, queue, parent
    ("Root", (0, 0, 0), (0, 0.20, 0), None),
    ("Hips", (0, 0, 0.95), (0, 0, 1.10), "Root"),
    ("Spine", (0, 0, 1.10), (0, 0, 1.28), "Hips"),
    ("Chest", (0, 0, 1.28), (0, 0, 1.45), "Spine"),
    ("Neck", (0, 0, 1.45), (0, 0, 1.56), "Chest"),
    ("Head", (0, 0, 1.56), (0, 0, 1.80), "Neck"),
]
for s, sx in (("L", 1), ("R", -1)):
    BONES += [
        (f"Shoulder_{s}", (0.03 * sx, 0, 1.42), (0.19 * sx, 0, 1.43), "Chest"),
        (f"UpperArm_{s}", (0.19 * sx, 0, 1.43), (0.36 * sx, 0, 1.20), f"Shoulder_{s}"),
        (f"LowerArm_{s}", (0.36 * sx, 0, 1.20), (0.50 * sx, 0, 0.99), f"UpperArm_{s}"),
        (f"Hand_{s}", (0.50 * sx, 0, 0.99), (0.60 * sx, -0.01, 0.82), f"LowerArm_{s}"),
        (f"Thigh_{s}", (0.10 * sx, 0, 0.95), (0.115 * sx, 0, 0.52), "Hips"),
        (f"Shin_{s}", (0.115 * sx, 0, 0.52), (0.125 * sx, 0.01, 0.09), f"Thigh_{s}"),
        (f"Foot_{s}", (0.125 * sx, 0.01, 0.09), (0.13 * sx, -0.13, 0.035), f"Shin_{s}"),
    ]
CONNECTED = {"Spine", "Chest", "Neck", "Head", "UpperArm_L", "UpperArm_R", "LowerArm_L", "LowerArm_R", "Hand_L", "Hand_R",
             "Shin_L", "Shin_R", "Foot_L", "Foot_R"}

arm_data = bpy.data.armatures.new("RoninRig")
arm = bpy.data.objects.new("Ronin", arm_data)
scene.collection.objects.link(arm)
activate(arm)
bpy.ops.object.mode_set(mode="EDIT")
for name, h, t, p in BONES:
    e = arm_data.edit_bones.new(name)
    e.head, e.tail = h, t
    if p:
        e.parent = arm_data.edit_bones[p]
        e.use_connect = name in CONNECTED
bpy.ops.object.mode_set(mode="OBJECT")
SEG = {n: (np.array(h, float), np.array(t, float)) for n, h, t, _ in BONES if n != "Root"}

# ---------------------------------------------------------------- corps (modificateur Skin)
V = [((0, 0, 0.98), (0.150, 0.110)), ((0, 0, 1.10), (0.130, 0.100)), ((0, 0, 1.28), (0.170, 0.120)), ((0, 0, 1.40), (0.150, 0.105)),
     ((0, 0, 1.47), (0.068, 0.068)), ((0, 0, 1.57), (0.056, 0.056))]
E = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]
for sx in (1, -1):
    a = len(V)
    V += [((0.19 * sx, 0, 1.43), (0.066, 0.066)), ((0.36 * sx, 0, 1.20), (0.050, 0.050)), ((0.50 * sx, 0, 0.99), (0.038, 0.032)),
          ((0.565 * sx, -0.005, 0.89), (0.046, 0.024)), ((0.600 * sx, -0.010, 0.82), (0.032, 0.019))]
    E += [(3, a), (a, a + 1), (a + 1, a + 2), (a + 2, a + 3), (a + 3, a + 4)]
    b = len(V)
    V += [((0.10 * sx, 0, 0.95), (0.088, 0.088)), ((0.115 * sx, 0, 0.52), (0.060, 0.060)), ((0.125 * sx, 0.01, 0.085), (0.044, 0.044)),
          ((0.130 * sx, -0.14, 0.032), (0.048, 0.030)), ((0.125 * sx, 0.035, 0.036), (0.040, 0.034))]
    E += [(0, b), (b, b + 1), (b + 1, b + 2), (b + 2, b + 3), (b + 2, b + 4)]          # pied + talon

me = bpy.data.meshes.new("body")
me.from_pydata([v for v, _ in V], E, [])
body = bpy.data.objects.new("body", me)
scene.collection.objects.link(body)
body.modifiers.new("skin", "SKIN")
for i, (_, r) in enumerate(V):
    d = me.skin_vertices[0].data[i]
    d.radius = r
    d.use_root = i == 0
sub = body.modifiers.new("sub", "SUBSURF")
sub.levels = sub.render_levels = 2
activate(body)
bpy.ops.object.modifier_apply(modifier="skin")
bpy.ops.object.modifier_apply(modifier="sub")
for m_ in MAT_ORDER:
    body.data.materials.append(M[m_])
for poly in body.data.polygons:
    c = poly.center
    if abs(c.x) > 0.47 and c.z < 1.02:
        poly.material_index = MAT_ORDER.index("wrap")
    elif c.z < 0.13:
        poly.material_index = MAT_ORDER.index("wrap")
    elif c.z > 1.46:
        poly.material_index = MAT_ORDER.index("skin")
    else:
        poly.material_index = MAT_ORDER.index("cloth")


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a[None] + t[:, None] * ab[None]), axis=1)


P = np.array([v.co[:] for v in body.data.vertices])
names = list(SEG)
D = np.stack([seg_dist(P, *SEG[n]) for n in names], 1)
side = np.array([1 if n.endswith("_L") else -1 if n.endswith("_R") else 0 for n in names])
bad = ((side[None] == 1) & (P[:, :1] < -0.02)) | ((side[None] == -1) & (P[:, :1] > 0.02))
W = np.where(bad, 0.0, 1.0 / (D + 0.008) ** 6)
top = np.argsort(-W, 1)[:, :3]
for n in names:
    body.vertex_groups.new(name=n)
for i in range(len(P)):
    w = W[i, top[i]]
    w = w / w.sum()
    for j, wj in zip(top[i], w):
        if wj > 0.02:
            body.vertex_groups[names[j]].add([i], float(wj), "REPLACE")


# ---------------------------------------------------------------- pièces rigides (armure, tête)
PARTS = []


def finish(o, material, bone, sub_levels=0, bevel=0.0, smooth=True):
    activate(o)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        bm = o.modifiers.new("bev", "BEVEL")
        bm.width, bm.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier="bev")
    if sub_levels:
        sm = o.modifiers.new("sub", "SUBSURF")
        sm.levels = sm.render_levels = sub_levels
        bpy.ops.object.modifier_apply(modifier="sub")
    if smooth:
        bpy.ops.object.shade_smooth()
    o.data.materials.clear()
    for m_ in MAT_ORDER:
        o.data.materials.append(M[m_])
    for poly in o.data.polygons:
        poly.material_index = MAT_ORDER.index(material)
    g = o.vertex_groups.new(name=bone)
    g.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
    PARTS.append(o)
    return o


def sphere(loc, scale, material, bone, keep=None, seg=32, ring=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, location=loc, scale=scale)
    o = bpy.context.active_object
    if keep:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        mw = o.matrix_world
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(mw @ v.co)], context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
        sol = o.modifiers.new("sol", "SOLIDIFY")
        sol.thickness = 0.006
        activate(o)
        bpy.ops.object.modifier_apply(modifier="sol")
    return finish(o, material, bone)


def box(loc, size, rot, material, bone, bevel=0.006, sub_levels=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot, scale=size)
    return finish(bpy.context.active_object, material, bone, sub_levels=sub_levels, bevel=bevel)


def tube(a, b, r0, r1, material, bone, verts=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return finish(o, material, bone, bevel=0.004, sub_levels=1)


def torus(loc, R, r, scale, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=48, minor_segments=12)
    o = bpy.context.active_object
    o.scale = scale
    return finish(o, material, bone)


HC = Vector((0, -0.008, 1.665))
sphere(HC, (0.088, 0.100, 0.115), "skin", "Head")                                                  # tête
sphere((0, -0.002, 1.680), (0.094, 0.106, 0.118), "hair", "Head",
       keep=lambda p: not (p.y < -0.035 and p.z < 1.735))                                           # cheveux (calotte)
sphere((0, -0.014, 1.618), (0.093, 0.103, 0.068), "steel", "Head",
       keep=lambda p: p.y < -0.030 and p.z < 1.650)                                                 # demi-masque d'acier
for sx in (1, -1):
    sphere((0.032 * sx, -0.093, 1.672), (0.013, 0.006, 0.007), "hair", "Head", seg=12, ring=8)       # yeux
torus((0, -0.004, 1.712), 0.098, 0.011, (0.93, 1.06, 1.0), "sash", "Head", rot=(math.radians(-8), 0, 0))   # bandeau
sphere((0, 0.070, 1.775), (0.030, 0.030, 0.026), "hair", "Head", seg=16, ring=10)                  # chignon
tube((0, 0.060, 1.765), (0, 0.118, 1.800), 0.012, 0.007, "hair", "Head", verts=12)

sphere((0, -0.008, 1.305), (0.205, 0.148, 0.172), "lacquer", "Chest")                            # plastron (cuirasse bombée)
for i in range(3):
    box((0, -0.138 + 0.006 * i, 1.215 + 0.050 * i), (0.25 - 0.02 * i, 0.020, 0.040), (math.radians(-6), 0, 0), "gold", "Chest", bevel=0.004)   # lames du plastron
torus((0, 0, 1.050), 0.140, 0.034, (1.0, 0.80, 1.0), "sash", "Hips")                                # obi
box((0.050, -0.122, 1.030), (0.060, 0.030, 0.070), (0, 0, 0), "sash", "Hips", bevel=0.01)           # nœud
for sx in (1, -1):
    for k in range(3):                                                                              # sode (épaulières à lames)
        box((0.255 * sx, 0, 1.425 - 0.048 * k), (0.110 + 0.010 * k, 0.175 + 0.008 * k, 0.020),
            (0, math.radians(38 * sx), 0), "lacquer" if k < 2 else "gold", f"UpperArm_{'L' if sx > 0 else 'R'}", bevel=0.005)
    s = "L" if sx > 0 else "R"
    tube((0.375 * sx, 0, 1.180), (0.495 * sx, 0, 1.000), 0.050, 0.041, "steel", f"LowerArm_{s}")      # kote (avant-bras)
    tube((0.117 * sx, -0.008, 0.470), (0.124 * sx, -0.002, 0.150), 0.064, 0.050, "steel", f"Shin_{s}")   # suneate (tibias)
    for zf in (0.0, 1.0):                                                                           # kusazuri (jupe d'armure) avant/arrière
        y = -0.118 if zf == 0 else 0.118
        box((0.085 * sx, y, 0.880), (0.140, 0.016, 0.200), (math.radians(10 if zf == 0 else -10), 0, 0), "lacquer", "Hips", bevel=0.004)

# ---------------------------------------------------------------- assemblage + skinning
activate(body)
for o in PARTS:
    o.select_set(True)
bpy.ops.object.join()
body.name = body.data.name = "Ronin_Mesh"
body.parent = arm
mod = body.modifiers.new("rig", "ARMATURE")
mod.object = arm

# ---------------------------------------------------------------- points d'accroche d'effets
SOCKETS = [("FX_Hand_R", "Hand_R", (-0.575, -0.03, 0.86)), ("FX_Hand_L", "Hand_L", (0.575, -0.03, 0.86)),
           ("FX_Weapon_R", "Hand_R", (-0.565, -0.01, 0.885)), ("FX_Weapon_L", "Hand_L", (0.565, -0.01, 0.885)),
           ("FX_Chest", "Chest", (0, -0.17, 1.32)), ("FX_Head", "Head", (0, 0, 1.86)),
           ("FX_Foot_R", "Foot_R", (-0.13, -0.06, 0.02)), ("FX_Foot_L", "Foot_L", (0.13, -0.06, 0.02)), ("FX_Aura", "Root", (0, 0, 0))]
for name, bone, loc in SOCKETS:
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    scene.collection.objects.link(e)
    e.parent = arm
    e.parent_type = "BONE"
    e.parent_bone = bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(loc)

# ---------------------------------------------------------------- animations
pose = arm.pose
for pb in pose.bones:
    pb.rotation_mode = "QUATERNION"


def reset():
    for pb in pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()


def aim(name, d, twist=0.0):
    pb = pose.bones[name]
    bone = pb.bone
    y = (bone.tail_local - bone.head_local).normalized()
    q = y.rotation_difference(Vector(d).normalized())
    Mx = (q.to_matrix() @ bone.matrix_local.to_3x3()).to_4x4()
    Mx.translation = pb.head
    pb.matrix = Mx
    bpy.context.view_layer.update()
    if twist:
        pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion((0, 1, 0), twist)
        bpy.context.view_layer.update()


def guard(side, lift=0.0):
    sx = 1 if side == "L" else -1
    aim(f"UpperArm_{side}", (0.30 * sx, -0.45, -0.84 + lift))
    aim(f"LowerArm_{side}", (-0.30 * sx, -0.55, 0.78 + lift))
    aim(f"Hand_{side}", (-0.20 * sx, -0.55, 0.80))


def stance(breath=0.0, twist=0.0, lean=0.0):
    aim("Spine", (0, -0.05 - lean, 1), twist=twist * 0.4)
    aim("Chest", (0, -0.02 - lean + breath, 1), twist=twist * 0.6)
    aim("Head", (0, -0.02, 1), twist=-twist * 0.8)
    for s, sx in (("L", 1), ("R", -1)):
        aim(f"Thigh_{s}", (0.06 * sx, -0.10 if s == "L" else 0.08, -1))
        aim(f"Shin_{s}", (0.02 * sx, 0.12 if s == "L" else 0.16, -1))
        aim(f"Foot_{s}", (0.01 * sx, -1, -0.35))
    # recolle les pieds au sol (le genou fléchi raccourcit la jambe)
    low = min(pose.bones[f"Foot_{s}"].head.z for s in "LR")
    pose.bones["Hips"].location = (0, -(low - 0.071), 0)
    bpy.context.view_layer.update()


def key(frame):
    for pb in pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)


def new_action(name):
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    return act


def idle_pose(f):
    reset()
    b = 0.02 * math.sin(2 * math.pi * f / 60)
    stance(breath=b)
    guard("L", lift=b)
    guard("R", lift=b)


new_action("Idle")
for f in (0, 15, 30, 45, 60):
    idle_pose(f)
    key(f)


def punch_pose(t):
    reset()
    stance(twist=0.40 * t, lean=0.05 * t)
    guard("L")
    if t <= 0:
        guard("R")
    else:
        g = np.array([(-0.30, -0.45, -0.84), (0.30, -0.55, 0.78), (0.20, -0.55, 0.80)])
        x = np.array([(-0.06, -1.0, 0.04), (0.0, -1.0, 0.04), (0.0, -1.0, 0.0)])
        dirs = (1 - t) * g + t * x
        aim("UpperArm_R", dirs[0])
        aim("LowerArm_R", dirs[1])
        aim("Hand_R", dirs[2])


new_action("Punch_R")
for f, t in ((0, 0.0), (4, -0.0), (9, 1.0), (13, 1.0), (24, 0.0)):
    punch_pose(t)
    key(f)

# ---------------------------------------------------------------- export
OUT.mkdir(parents=True, exist_ok=True)
glb = OUT / "ronin_character.glb"
arm.animation_data.action = bpy.data.actions["Idle"]
for o in bpy.context.view_layer.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_yup=True, export_skins=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_force_sampling=True, export_apply=False)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f"OK : {tris} triangles, {len(BONES)} os, animations Idle + Punch_R, {len(SOCKETS)} points FX -> {glb}")

# ---------------------------------------------------------------- aperçus
if PREV:
    PREV.mkdir(parents=True, exist_ok=True)
    floor = bpy.data.objects.new("floor", bpy.data.meshes.new("floor"))
    floor.data.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    floor.data.materials.append(mat("floor", (0.03, 0.032, 0.04), 0.6))
    scene.collection.objects.link(floor)
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.045, 0.05, 0.065, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3

    def light(name, loc, power, size, color):
        d = bpy.data.lights.new(name, "AREA")
        d.energy, d.size, d.color = power, size, color
        o = bpy.data.objects.new(name, d)
        scene.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    light("key", (-2.2, -3.0, 3.0), 900, 2.0, (1.0, 0.95, 0.88))
    light("rim", (2.4, 2.6, 2.4), 800, 1.5, (0.55, 0.75, 1.0))
    light("fill", (2.6, -2.8, 1.0), 250, 3.0, (0.9, 0.92, 1.0))
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -1.0
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1400
    cd = bpy.data.cameras.new("cam")
    cd.lens = 50
    cam = bpy.data.objects.new("cam", cd)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (2.0, -4.4, 1.35)
    cam.rotation_euler = (Vector((0, 0, 0.95)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    for action, frame, fname in (("Idle", 0, "ronin_idle.png"), ("Punch_R", 10, "ronin_punch.png")):
        arm.animation_data.action = bpy.data.actions[action]
        scene.frame_set(frame)
        scene.render.filepath = str(PREV / fname)
        bpy.ops.render.render(write_still=True)
    print("aperçus ->", PREV)

for action in ("Idle", "Punch_R"):
    arm.animation_data.action = bpy.data.actions[action]
    for f in (0, 10):
        scene.frame_set(f)
        ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        z = min((ev.matrix_world @ v.co).z for v in ev.data.vertices)
        print(f"contrôle sol {action} f{f} : z min = {z:+.3f} m")
