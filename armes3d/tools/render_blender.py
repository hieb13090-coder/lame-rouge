"""Rendu Cycles (Blender sans écran) d'un GLB d'arme : vue diagonale + gros plan sur la garde.

Usage : python3 render_blender.py in.glb out_hero.png out_detail.png
"""
import math
import os
import sys

import bpy
from mathutils import Vector

glb, out_hero, out_detail = sys.argv[1:4]
out_blade = sys.argv[4] if len(sys.argv) > 4 else None
EMIS = float(sys.argv[5]) if len(sys.argv) > 5 else 14.0
FIRE = len(sys.argv) > 6 and sys.argv[6] == "fire"

bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    bpy.ops.import_scene.gltf(filepath=glb)
except Exception:
    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    bpy.ops.import_scene.gltf(filepath=glb)

scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]

# --- boost des matériaux émissifs (runes) ---
for o in meshes:
    for slot in o.material_slots:
        nt = slot.material.node_tree
        for n in nt.nodes:
            if n.type == "BSDF_PRINCIPLED":
                linked = n.inputs["Emission Color"].is_linked
                n.inputs["Emission Strength"].default_value = EMIS if (linked or "rune" in slot.material.name.lower()) else 0.0

# --- centre de l'arme ---
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
mx = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
center = (mn + mx) / 2

pivot = bpy.data.objects.new("pivot", None)
scene.collection.objects.link(pivot)
pivot.location = center
bpy.context.view_layer.update()
for o in meshes:
    o.parent = pivot
    o.matrix_parent_inverse = pivot.matrix_world.inverted()


# --- monde et lumières (studio sombre avec grands softboxes) ---
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.045, 0.05, 0.065, 1)
bg.inputs["Strength"].default_value = 0.25


def area(name, loc, target, power, size, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA")
    d.energy, d.size, d.color = power, size, color
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    direction = Vector(target) - Vector(loc)
    o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return o


tgt = tuple(center)
area("key", (center.x - 1.6, center.y - 2.2, center.z + 1.4), tgt, 600, 1.8, (1.0, 0.95, 0.88))
area("rim", (center.x + 1.8, center.y + 1.6, center.z + 0.6), tgt, 450, 1.2, (1.0, 0.42, 0.14) if FIRE else (0.55, 0.75, 1.0))
area("fill", (center.x + 1.6, center.y - 2.0, center.z - 0.4), tgt, 180, 2.5, (0.9, 0.92, 1.0))
area("top_strip", (center.x, center.y - 0.6, center.z + 2.2), tgt, 250, 0.6)

# --- rendu ---
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1400
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -1.8

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def aim(cam_obj, loc, target):
    cam_obj.location = loc
    cam_obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


# 1) hero : vue orthographique, épée inclinée comme sur une planche de concept
cam_data.type = "ORTHO"
cam_data.ortho_scale = float(os.environ.get('ORTHO', 1.75))
_pv = os.environ.get('PIVOT')
pivot.rotation_euler = tuple(math.radians(float(v)) for v in _pv.split(',')) if _pv else (0, math.radians(float(os.environ.get('TILT', 38))), 0)
aim(cam, (center.x, center.y - 5, center.z), tuple(center))
scene.render.filepath = out_hero
bpy.ops.render.render(write_still=True)

# 2) détail : perspective sur la garde, la poignée et le pommeau
cam_data.type = "PERSP"
cam_data.lens = 75
pivot.rotation_euler = (0, 0, 0)
detail_target = (0, 0, 0.0)  # origine = centre de la poignée
DZ = float(os.environ.get('DETAIL_Z', 0.02))
_dc = os.environ.get('DCAM')
aim(cam, tuple(float(v) for v in _dc.split(',')) if _dc else (0.55, -1.25, DZ + 0.14), (0, 0, DZ))
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.filepath = out_detail
bpy.ops.render.render(write_still=True)
if out_blade:
    # 3) lame : runes et rayures, vu de face
    cam_data.lens = 85
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1400
    BZ = float(os.environ.get('BLADE_Z', 0.50))
    aim(cam, (0.10, -0.95, BZ + 0.10), (0.03, 0, BZ))
    scene.render.filepath = out_blade
    bpy.ops.render.render(write_still=True)
print("rendus ->", out_hero, out_detail, out_blade)
