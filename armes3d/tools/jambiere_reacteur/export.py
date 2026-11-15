import sys; sys.path.insert(0, '/home/claude/blender')
exec(open('/home/claude/blender/assemble.py').read())
out = sys.argv[-1]
bpy.data.objects.remove(leg, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=out.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_apply=True,
                          export_yup=True, use_selection=False)
print('GLB ok')
