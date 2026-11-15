import sys; sys.path.insert(0, '/home/claude/blender')
exec(open('/home/claude/blender/assemble.py').read())
import time
view = sys.argv[-2]; out = sys.argv[-1]
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(__import__('os').environ.get('SPP', '28'))
try: sc.cycles.use_denoising = True
except Exception as e: print('denoise', e)
sc.render.resolution_x, sc.render.resolution_y = 760, 900
sc.render.film_transparent = False
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.09, 0.105, 0.14, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

def light(name, loc, energy, size, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; link(o)
    t = o.constraints.new('TRACK_TO'); t.target = focus; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
    return o
focus = empty('focus', (0, 0, 5.2))

cfg = {
 'rear':   dict(cam=(4.5, 24, 7.0), frame=1,  cut=False, leg=False),
 'rear_open': dict(cam=(4.5, 24, 7.0), frame=40, cut=False, leg=False),
 'rear34': dict(cam=(15, 17, 7.5), frame=40, cut=False, leg=False),
 'front34': dict(cam=(-14, -20, 8), frame=1, cut=False, leg=False),
 'cut':    dict(cam=(26, -2, 6.5), frame=1, cut=True, leg=True),
 'cut_open': dict(cam=(26, 5, 6.5), frame=40, cut=True, leg=True),
}[view]
sc.frame_set(cfg['frame'])
if not cfg['leg']: leg.hide_render = True
if cfg['cut']:
    for o in (shell, leg):
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
        bm.to_mesh(o.data); bm.free()
    for o in list(reactor.children) + [pivot]:
        pass
    # on masque la moitié droite du réacteur et de la plaque : on garde tout, la coupe sert à voir l'intérieur
cam = bpy.data.cameras.new('c'); cam.lens = 80
co = bpy.data.objects.new('c', cam); co.location = cfg['cam']; link(co); sc.camera = co
t = co.constraints.new('TRACK_TO'); t.target = focus; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
cx, cy, cz = cfg['cam']
light('cle', (cx * 0.8 + 6, cy * 0.8 + 4, 18), 9000, 10, (1.0, 0.97, 0.92))
light('rim', (-cx * 0.6 - 12, -cy * 0.6 - 10, 10), 4200, 8, (0.45, 0.65, 1.0))
light('fill', (cx * 0.5 - 8, cy * 0.9, 2), 2600, 10, (0.8, 0.85, 1.0))
sc.render.filepath = out; t0 = time.time()
bpy.ops.render.render(write_still=True)
print('rendu', view, round(time.time() - t0), 's')
