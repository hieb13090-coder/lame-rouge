"""Passe de vieillissement / cuisson (Blender Cycles, sans écran) : GLB -> GLB prêt pour le jeu.

Ajoute ce que font les pipelines AAA après la modélisation :
- occlusion ambiante cuite (contact entre pièces, creux) ;
- usure des arêtes du métal (arêtes vives plus claires et plus lisses), via le nœud Bevel ;
- crasse dans les cavités (plus sombre, plus rugueux), modulée par un bruit ;
- arêtes adoucies cuites dans la normal map (reflets sur les chanfreins).
Sortie : un seul matériau, UV uniques (dépliage automatique), textures base couleur / métal-rugosité / normal (/ émissif).

Usage : python3 bake_weathering.py in.glb out.glb [taille=2048] [force=1.0]
"""
import math
import sys

import bpy
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
K = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"

meshes = [o for o in scene.objects if o.type == "MESH"]
for o in bpy.context.view_layer.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = obj.data.name = "Weapon"
bpy.ops.object.transform_apply(location=False, rotation=False, scale=False)

# soudure (les GLB générés sont non soudés) en gardant les arêtes vives
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-6, use_sharp_edge_from_normals=True)
bpy.ops.object.mode_set(mode="OBJECT")

me = obj.data
orig_uv = me.uv_layers[0].name
bake_uv = me.uv_layers.new(name="Bake")
me.uv_layers.active = bake_uv
me.uv_layers[orig_uv].active_render = True
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
bpy.ops.object.mode_set(mode="OBJECT")


def img(name, color=True):
    im = bpy.data.images.new(name, SIZE, SIZE, alpha=False, float_buffer=not color)
    im.colorspace_settings.name = "sRGB" if color else "Non-Color"
    return im


def src_socket(nt, bsdf, name):
    s = bsdf.inputs[name]
    return s.links[0].from_socket if s.is_linked else None


def const(nt, value):
    if isinstance(value, (float, int)):
        n = nt.nodes.new("ShaderNodeValue")
        n.outputs[0].default_value = float(value)
    else:
        n = nt.nodes.new("ShaderNodeRGB")
        n.outputs[0].default_value = tuple(value)
    return n.outputs[0]


def math_node(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (float, int)):
            n.inputs[i].default_value = float(x)
        else:
            nt.links.new(x, n.inputs[i])
    return n.outputs[0]


def mix(nt, fac, a, b, blend="MIX"):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    n.blend_type = blend
    for sock, x in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(x, (float, int)):
            sock.default_value = float(x)
        elif isinstance(x, tuple):
            sock.default_value = x
        else:
            nt.links.new(x, sock)
    return n.outputs[2]


targets = dict(base=img("base"), rough=img("rough", False), metal=img("metal", False), normal=img("normal", False), emis=img("emis"))
has_emis = False
CH = {}
for slot in obj.material_slots:
    m = slot.material
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    name = m.name.lower()
    base = src_socket(nt, bsdf, "Base Color") or const(nt, bsdf.inputs["Base Color"].default_value)
    rough = src_socket(nt, bsdf, "Roughness") or const(nt, bsdf.inputs["Roughness"].default_value)
    metal = src_socket(nt, bsdf, "Metallic") or const(nt, bsdf.inputs["Metallic"].default_value)
    emis = src_socket(nt, bsdf, "Emission Color")
    if emis is not None and ("rune" in name or "glow" in name or "core" in name or "blade" in name or "fire" in name):
        has_emis = True
    nrm = src_socket(nt, bsdf, "Normal")

    # arêtes adoucies : Bevel alimenté par la normal map d'origine
    bev = nt.nodes.new("ShaderNodeBevel")
    bev.samples = 8
    bev.inputs["Radius"].default_value = 0.00035 if "blade" in name else 0.0011
    if nrm is not None:
        nt.links.new(nrm, bev.inputs["Normal"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    bev_e = nt.nodes.new("ShaderNodeBevel")
    bev_e.samples = 8
    bev_e.inputs["Radius"].default_value = 0.0016
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    nt.links.new(bev_e.outputs[0], dot.inputs[0])
    nt.links.new(geo.outputs["Normal"], dot.inputs[1])
    edge = math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", 1.0, dot.outputs["Value"]), 14.0 * K, clamp=True)

    ao_n = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao_n.samples = 16
    ao_n.inputs["Distance"].default_value = 0.025
    ao = ao_n.outputs["AO"]
    cav_n = nt.nodes.new("ShaderNodeAmbientOcclusion")
    cav_n.samples = 16
    cav_n.only_local = True
    cav_n.inputs["Distance"].default_value = 0.006
    cav = math_node(nt, "SUBTRACT", 1.0, cav_n.outputs["AO"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 90.0
    noise.inputs["Detail"].default_value = 6.0
    grime = math_node(nt, "MULTIPLY", cav, math_node(nt, "MULTIPLY", noise.outputs["Fac"], 1.6 * K), clamp=True)

    edge_m = math_node(nt, "MULTIPLY", edge, metal, clamp=True)
    aofac = math_node(nt, "ADD", 0.45, math_node(nt, "MULTIPLY", ao, 0.55))
    c = mix(nt, 1.0, base, aofac, "MULTIPLY")
    c = mix(nt, math_node(nt, "MULTIPLY", edge_m, 0.55), c, mix(nt, 1.0, base, (1.45, 1.45, 1.45, 1), "MULTIPLY"))
    c = mix(nt, math_node(nt, "MULTIPLY", grime, 0.55), c, (0.012, 0.010, 0.008, 1))
    r = math_node(nt, "ADD", rough, math_node(nt, "MULTIPLY", grime, 0.35), clamp=False)
    r = math_node(nt, "SUBTRACT", r, math_node(nt, "MULTIPLY", edge_m, 0.12), clamp=True)

    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    nt.nodes.active = tex
    CH[m.name] = dict(nt=nt, bsdf=bsdf, out=out, em=em, tex=tex, base=c, rough=r, metal=metal,
                      emis=(emis if emis is not None else const(nt, (0, 0, 0, 1))), bev=bev,
                      emis_strength=bsdf.inputs["Emission Strength"].default_value)


def set_target(image):
    for ch in CH.values():
        ch["tex"].image = image
        ch["nt"].nodes.active = ch["tex"]


def bake_emit(key):
    for ch in CH.values():
        nt = ch["nt"]
        nt.links.new(ch[key], ch["em"].inputs["Color"])
        nt.links.new(ch["em"].outputs[0], ch["out"].inputs["Surface"])
    set_target(targets[key])
    r = bpy.ops.object.bake(type="EMIT", uv_layer="Bake", margin=12, use_clear=True)
    BAKED[key] = np.array(targets[key].pixels[:], np.float32).reshape(SIZE, SIZE, 4)
    print("bake", key, r, "moyenne", float(BAKED[key][..., :3].mean()))


BAKED = {}
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
# 1) normal : BSDF d'origine avec normal map + bevel
scene.cycles.samples = 16
for ch in CH.values():
    ch["nt"].links.new(ch["bev"].outputs[0], ch["bsdf"].inputs["Normal"])
set_target(targets["normal"])
bpy.ops.object.bake(type="NORMAL", uv_layer="Bake", margin=12, normal_space="TANGENT", use_clear=True)
BAKED["normal"] = np.array(targets["normal"].pixels[:], np.float32).reshape(SIZE, SIZE, 4)
# 2) canaux via émission
scene.cycles.samples = 16
for key in ("base", "rough", "metal") + (("emis",) if has_emis else ()):
    bake_emit(key)
    print("cuit :", key)

# ---- emballage glTF : metallicRoughness (G = rugosité, B = métal)
r, mtl = BAKED["rough"][..., 0], BAKED["metal"][..., 0]
BAKED["weapon_mr"] = np.stack([np.ones_like(r), r, mtl, np.ones_like(r)], -1)
mr = bpy.data.images.new("weapon_mr", SIZE, SIZE, alpha=False, float_buffer=False)
mr.colorspace_settings.name = "Non-Color"
mr.pixels[:] = np.stack([np.ones_like(r), r, mtl, np.ones_like(r)], -1).ravel()

# ---- matériau final unique
final = bpy.data.materials.new("weapon_baked")
final.use_nodes = True
nt = final.node_tree
b = nt.nodes["Principled BSDF"]
uvn = nt.nodes.new("ShaderNodeUVMap")
uvn.uv_map = "Bake"


def tex_node(image, color=True):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = image
    image.colorspace_settings.name = "sRGB" if color else "Non-Color"
    nt.links.new(uvn.outputs[0], t.inputs[0])
    return t


tb = tex_node(targets["base"])
nt.links.new(tb.outputs[0], b.inputs["Base Color"])
tm = tex_node(mr, False)
sep = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(tm.outputs[0], sep.inputs[0])
nt.links.new(sep.outputs[1], b.inputs["Roughness"])
nt.links.new(sep.outputs[2], b.inputs["Metallic"])
tn = tex_node(targets["normal"], False)
nmap = nt.nodes.new("ShaderNodeNormalMap")
nmap.uv_map = "Bake"
nt.links.new(tn.outputs[0], nmap.inputs["Color"])
nt.links.new(nmap.outputs[0], b.inputs["Normal"])
if has_emis:
    te = tex_node(targets["emis"])
    nt.links.new(te.outputs[0], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 1.0

me.materials.clear()
me.materials.append(final)
for p in me.polygons:
    p.material_index = 0
me.uv_layers.remove(me.uv_layers[orig_uv])
import os
import tempfile
from PIL import Image as PILImage
tmpd = tempfile.mkdtemp()
for node in nt.nodes:
    if node.type == "TEX_IMAGE":
        im = node.image
        a = BAKED[im.name][::-1, :, :3]
        path = os.path.join(tmpd, im.name + ".png")
        PILImage.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)
        cs = im.colorspace_settings.name
        new = bpy.data.images.load(path)
        new.colorspace_settings.name = cs
        node.image = new
for o in bpy.context.view_layer.objects:
    o.select_set(o == obj)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_yup=True, export_image_format="AUTO")
print(f"OK : {dst} ({SIZE}px, émissif={has_emis})")
