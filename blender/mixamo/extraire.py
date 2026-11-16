# Mains, axes de la main droite, torse : dans le repère du bassin (Spine), converti au repère du jeu (+X gauche, +Y haut, +Z devant)
import bpy, sys, json
from mathutils import Vector, Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.import_scene.fbx(filepath=src)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
act = arm.animation_data.action; f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
P = lambda n: arm.pose.bones['mixamorig:' + n]
g = lambda v: [v.x, v.z, -v.y]                       # Blender (Z haut, -Y devant) -> jeu
sc = bpy.context.scene; fr = []
W = arm.matrix_world
for f in range(f0, f1 + 1):
    sc.frame_set(f)
    hips = W @ P('Hips').head
    def pos(n): v = W @ P(n).head - hips; return g(v)
    def axes(n):
        m = (W.to_3x3() @ P(n).matrix.to_3x3()).normalized(); return [g(m.col[i]) for i in range(3)]
    fr.append({'hips': g(hips), 'spine': pos('Spine'), 'spine2': pos('Spine2'), 'neck': pos('Neck'),
               'lsh': pos('LeftArm'), 'rsh': pos('RightArm'), 'lh': pos('LeftHand'), 'rh': pos('RightHand'),
               'lul': pos('LeftUpLeg'), 'rul': pos('RightUpLeg'), 'lf': pos('LeftFoot'), 'rf': pos('RightFoot'),
               'rax': axes('RightHand'), 'mid': pos('RightHandMiddle1'), 'thumb': pos('RightHandThumb1')})
json.dump({'fps': sc.render.fps, 'frames': fr}, open(out, 'w')); print('ok', len(fr))
