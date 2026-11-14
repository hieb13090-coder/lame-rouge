"""Poings-Wyrm v3 : gantelets de super-guerrier (énormes, blindés, angulaires), esprit dragon (conception originale) -> GLB, droite + gauche (miroir).
Poing fermé massif entièrement blindé : phalanges en lames d'acier sombre, garde de jointures dorée, plaques superposées sur le dos de la main,
large brassard à lames avec panneau d'écailles de dragon, noyau lumineux braise, crête d'épines. Les cornes de jointures (HORNS) et la griffe (CLAW) sont codées mais désactivées.
Repère : poing vers +Z, dos de la main +Y, pouce +X (droite), avant-bras vers -Z, origine = centre du poing. Taille ~0,5 m, poing ~0,2 m de large.
Usage : python3 gen_dragon_gauntlets.py <dossier>"""
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, capsule_profile, taper_profile  # noqa: E402
import naginata_textures as NT  # noqa: E402

H.SHIFT_Y = 0.0
HS = 1.32                                  # la main est plus grosse que la manchette (poing de Hulk)
S = 2.0                                    # gabarit « Hulk » : une main humaine x2
FX = [0.0368, 0.0123, -0.0123, -0.0368]    # index (+X, côté pouce) -> auriculaire
FR = [0.0128, 0.0132, 0.0128, 0.0116]      # rayons des doigts
FK = [0.97, 1.0, 0.97, 0.90]               # longueur relative
NF = 48
HORNS = False       # idée gardée : cornes de dragon sur les jointures (à réactiver plus tard)
CLAW = False        # griffe au pouce


def finger_path(x, k):
    pts = [(0.030, 0.010), (0.088, 0.020), (0.112, 0.004), (0.117, -0.026), (0.105, -0.052), (0.078, -0.063), (0.050, -0.059), (0.030, -0.045)]
    # k raccourcit la boucle (z et y), le départ reste ancré sur le dos de la main
    q = [(0.030, 0.010)] + [(0.030 + (z - 0.030) * k, 0.020 + (y - 0.020) * k) if i else (z, y) for i, (z, y) in enumerate(pts[1:], 1)]
    ctrl = [(x, y, z) for z, y in q]
    return H.catmull(ctrl, NF)


def fingers():
    out = []
    joint = lambda u, kk: -0.0010 * (np.exp(-((kk - 17) / 1.3) ** 2) + np.exp(-((kk - 30) / 1.3) ** 2))
    for x, r, k in zip(FX, FR, FK):
        p = finger_path(x, k)
        out += sweep(p, capsule_profile(NF, r), capsule_profile(NF, r), C=22, vscale=0.12, up=(1, 0, 0), delta=joint)
    return out


def plates():
    """Coques dures dorées sur la phalange proximale et la phalange médiane, avec interstice aux articulations."""
    out = []
    for x, r, k in zip(FX, FR, FK):
        p = finger_path(x, k)
        for a, b, grow in ((7, 21, 0.0042), (23, 34, 0.0036)):
            seg = p[a:b]
            n = len(seg)
            prof = (np.sin(np.linspace(0.04, 0.96, n) * np.pi) ** 0.06) * (r + grow)
            out += sweep(seg, prof * 1.04, prof * 0.98, C=24, vscale=0.08, power=3.6, up=(1, 0, 0), caps=(True, True))
    return out


def knuckle_guard():
    """Garde de jointures dorée en travers des 4 doigts (à la place des cornes)."""
    pts = [(x, finger_path(x, k)[13][1] + r * 0.95, finger_path(x, k)[13][2] + r * 0.55) for x, r, k in zip(FX, FR, FK)]
    xs = [p[0] for p in pts]
    ctrl = [(xs[0] + 0.020, pts[0][1] - 0.004, pts[0][2] - 0.001)] + pts + [(xs[-1] - 0.020, pts[-1][1] - 0.004, pts[-1][2] - 0.001)]
    ctrl = ctrl[::-1]
    path = H.catmull(ctrl, 34)
    return sweep(path, capsule_profile(34, 0.0125) ** 1.0, capsule_profile(34, 0.0110), C=24, vscale=0.06, power=4.0, up=(0, 1, 0), caps=(True, True))


def horns():
    out = []
    for x, r, k, h in zip(FX, FR, FK, (0.034, 0.040, 0.040, 0.030)):
        p = finger_path(x, k)[12]
        ctrl = [(p[0], p[1] + r * 0.55, p[2] - 0.006), (p[0], p[1] + r * 0.85 + 0.006, p[2] + 0.010), (p[0], p[1] + r * 0.85 + 0.012, p[2] + h)]
        out += sweep(H.catmull(ctrl, 14), taper_profile(14, 0.0072, 0.0, 1.15), taper_profile(14, 0.0072, 0.0, 1.15), C=12, vscale=0.05,
                     up=(1, 0, 0), caps=(True, False))
    return out if HORNS else []


def thumb():
    ctrl = [(0.056, -0.006, -0.002), (0.058, -0.028, 0.040), (0.053, -0.047, 0.088), (0.040, -0.058, 0.124), (0.016, -0.060, 0.136), (-0.008, -0.054, 0.130)]
    p = H.catmull(ctrl, 40)
    r = 0.0152 * (1 - 0.0 * np.linspace(0, 1, 40))
    leather = sweep(p, capsule_profile(40, r.max()), capsule_profile(40, r.max()), C=24, vscale=0.12, up=(0, 1, 0))
    seg = p[17:40]
    n = len(seg)
    prof = (np.sin(np.linspace(0.04, 0.96, n) * np.pi) ** 0.18) * 0.0200
    plate = sweep(seg, prof, prof * 0.96, C=24, vscale=0.08, power=3.4, up=(0, 1, 0), caps=(True, True))
    claw_c = [(-0.004, -0.052, 0.129), (-0.020, -0.048, 0.127), (-0.034, -0.040, 0.121), (-0.042, -0.030, 0.113)]
    claw = sweep(H.catmull(claw_c, 14), taper_profile(14, 0.0082, 0.0, 1.1), taper_profile(14, 0.0082, 0.0, 1.1), C=12, vscale=0.05,
                 up=(0, 1, 0), caps=(True, False))
    return leather, plate + (claw if CLAW else [])


def core():
    """Masse sous les doigts (dos + paume), petite et carrée : elle disparaît sous le blindage."""
    n = 40
    z = np.linspace(-0.030, 0.096, n)
    prof = capsule_profile(n, 1.0) ** 0.25
    return sweep(np.stack([np.zeros(n), np.full(n, -0.014), z], -1), 0.034 * prof, 0.047 * prof, C=36, vscale=0.19, power=4.5, up=(0, 1, 0))


def back_armor():
    """Plaques superposées (lames) sur le dos de la main + panneau d'écailles central."""
    lames = []
    for i, (z0, z1) in enumerate(((-0.036, 0.010), (-0.002, 0.044), (0.032, 0.078))):
        n = 16
        z = np.linspace(z0, z1, n)
        prof = np.sin(np.linspace(0.02, 0.98, n) * np.pi) ** 0.05
        g = 1.0 + 0.035 * i                       # chaque lame recouvre la précédente
        lames += sweep(np.stack([np.zeros(n), np.full(n, -0.012), z], -1), 0.0405 * g * prof, 0.0560 * g * prof, C=40, vscale=0.20, power=3.2,
                       up=(0, 1, 0), caps=(True, True))
    n = 30
    z = np.linspace(-0.030, 0.072, n)
    prof = capsule_profile(n, 1.0) ** 0.22
    y = 0.0335 + 0.0035 * np.linspace(0, 1, n)
    scales = sweep(np.stack([np.zeros(n), y, z], -1), 0.0045 * prof, 0.030 * prof, C=36, vscale=0.20, power=3.4, up=(0, 1, 0), caps=(True, True))
    return lames, scales


def sleeve_r(z):
    z = np.asarray(z, float)
    s = np.clip((-z - 0.02) / 0.18, 0, 1)
    return 0.036 + 0.014 * s ** 1.5, 0.046 + 0.018 * s ** 1.5   # (vertical, horizontal)


BR = 1.22          # le brassard est plus gros que le poignet : look « guerrier »


def cuff_parts():
    n = 50
    z = np.linspace(-0.200, -0.015, n)
    rv, rh = sleeve_r(z)
    under = sweep(np.stack([np.zeros(n), np.full(n, -0.010), z], -1), rv, rh, C=40, vscale=0.25, power=3.0, up=(0, 1, 0), caps=(True, True))
    lames = []
    for z0, z1 in ((-0.205, -0.150), (-0.158, -0.108), (-0.116, -0.070), (-0.078, -0.032)):
        m = 16
        zz = np.linspace(z0, z1, m)
        a, b = sleeve_r(zz)
        prof = np.sin(np.linspace(0.02, 0.98, m) * np.pi) ** 0.05
        lames += sweep(np.stack([np.zeros(m), np.full(m, -0.010), zz], -1), (a * BR + 0.003) * prof, (b * BR + 0.003) * prof, C=40, vscale=0.25, power=3.5,
                       up=(0, 1, 0), caps=(True, True))
    # panneau d'écailles de dragon sur le dessus
    m = 30
    zz = np.linspace(-0.196, -0.040, m)
    a, b = sleeve_r(zz)
    prof = capsule_profile(m, 1.0) ** 0.2
    y = -0.010 + a * BR + 0.003 + 0.002
    scales = sweep(np.stack([np.zeros(m), y, zz], -1), 0.0055 * prof, 0.036 * prof, C=36, vscale=0.25, power=3.4, up=(0, 1, 0), caps=(True, True))
    # noyau lumineux (fente braise) au centre du panneau
    core_g = sweep(np.stack([np.zeros(m), y + 0.0058, zz], -1), 0.0024 * prof, 0.0075 * prof, C=24, vscale=0.25, power=3.0, up=(0, 1, 0), caps=(True, True))
    return under, lames, scales, core_g


def ring(z0, z1, add, y=-0.010, n=6):
    z = np.linspace(z0, z1, n)
    rv, rh = sleeve_r(z)
    pr = np.sin(np.pi * np.linspace(0, 1, n)) ** 0.5
    return sweep(np.stack([np.zeros(n), np.full(n, y), z], -1), (rv * BR + 0.0045 + add * pr), (rh * BR + 0.0045 + add * pr), C=40, vscale=0.05, power=3.5,
                 up=(0, 1, 0), caps=(True, True))


def wrist_glow():
    """Anneau lumineux au poignet, entre la main et le brassard."""
    n = 6
    z = np.linspace(-0.026, -0.018, n)
    rv, rh = sleeve_r(z)
    pr = np.sin(np.pi * np.linspace(0, 1, n)) ** 0.5
    return sweep(np.stack([np.zeros(n), np.full(n, -0.010), z], -1), rv + 0.0040 * pr, rh + 0.0040 * pr, C=40, vscale=0.05, power=3.2, up=(0, 1, 0),
                 caps=(True, True))


def pistons():
    """Vérins latéraux (look mécanique de gantelet de combat) : corps acier + tige dorée + bague lumineuse."""
    body, rod, glow = [], [], []
    for sgn in (1, -1):
        z0, z1 = -0.180, -0.070
        rv, rh = sleeve_r(-0.12)
        x = sgn * (float(rh) * BR + 0.010)
        n = 20
        z = np.linspace(z0, z1, n)
        body += sweep(np.stack([np.full(n, x), np.full(n, -0.012), z], -1), 0.0105, 0.0105, C=24, vscale=0.1, power=2.0, up=(0, 1, 0), caps=(True, True))
        z = np.linspace(z1, -0.010, n)
        rod += sweep(np.stack([np.full(n, x * 0.97), np.full(n, -0.012), z], -1), 0.0052, 0.0052, C=16, vscale=0.1, up=(0, 1, 0), caps=(True, True))
        for zc in (-0.150, -0.100):
            z = np.linspace(zc - 0.004, zc + 0.004, 6)
            glow += sweep(np.stack([np.full(6, x), np.full(6, -0.012), z], -1), 0.0118, 0.0118, C=24, vscale=0.05, up=(0, 1, 0), caps=(True, True))
    return body, rod, glow


def spines():
    out = []
    for i in range(5):
        z = -0.190 + 0.026 * i
        rv, rh = sleeve_r(z)
        y = -0.010 + float(rv) * BR + 0.012
        hgt = 0.030 * (1 - 0.12 * i)
        ctrl = [(0, y - 0.004, z), (0, y + 0.35 * hgt, z - 0.003), (0, y + 0.75 * hgt, z - 0.011), (0, y + hgt, z - 0.022)]
        out += sweep(H.catmull(ctrl, 14), taper_profile(14, 0.0078, 0.0, 1.2), taper_profile(14, 0.0078, 0.0, 1.2), C=12, vscale=0.05, up=(1, 0, 0),
                     caps=(True, False))
    return out


def scaled(parts, k=S):
    return [(P * k, UV, F) for P, UV, F in parts]


def glow_material():
    from PIL import Image
    from trimesh.visual.material import PBRMaterial
    col = np.zeros((32, 32, 3), np.uint8)
    col[...] = (255, 52, 0)
    base = Image.fromarray(col)
    mr = Image.fromarray(np.tile(np.array([255, 110, 0], np.uint8), (32, 32, 1)))
    nm = Image.fromarray(np.tile(np.array([128, 128, 255], np.uint8), (32, 32, 1)))
    return PBRMaterial(name="dragon_core_rune", baseColorTexture=base, metallicRoughnessTexture=mr, normalTexture=nm, emissiveTexture=base,
                       emissiveFactor=[1.0, 1.0, 1.0], metallicFactor=1.0, roughnessFactor=1.0)


def plain_metal(seed, rgb, rough, metal=0.95, S=256, grain=0.05):
    """Métal uni à grain brossé discret (sans martelage) : plaques d'armure nettes."""
    from PIL import Image
    rng = np.random.default_rng(seed)
    n = NT.fbm((S, S), (4, 60), rng, octs=3, tile=True) if hasattr(NT, "fbm") else rng.random((S, S))
    lum = 1.0 + grain * (n - 0.5) * 2
    base = np.clip(np.stack([rgb[0] * lum, rgb[1] * lum, rgb[2] * lum], -1), 0, 1)
    mr = np.zeros((S, S, 3), np.float32)
    mr[..., 0] = 1.0
    mr[..., 1] = np.clip(rough + 0.06 * (n - 0.5), 0.05, 1)
    mr[..., 2] = metal
    nm = np.zeros((S, S, 3), np.uint8)
    nm[...] = (128, 128, 255)
    return dict(base=Image.fromarray((base * 255).astype(np.uint8)), mr=Image.fromarray((mr * 255).astype(np.uint8)), normal=Image.fromarray(nm))


SKIN = os.environ.get("GAUNTLET_SKIN", "metal")   # "metal" : tout en acier (défaut) ; "dragon" : écailles cramoisies + or (skin gardé pour une série de skins)


def build(out):
    seed = 101
    from PIL import Image, ImageEnhance
    from PIL import Image  # noqa: F401
    leather_tex = plain_metal(seed, (0.06, 0.06, 0.065), 0.62, metal=0.85, grain=0.15)   # sous-couche : maille sombre
    if SKIN == "dragon":
        scale_tex = NT.dragon_scale_textures(seed + 1, cells=12)
        gold_tex = NT.gilt_textures(seed + 2, tint=(0.86, 0.62, 0.20))
    else:                                       # tout métal : lames en acier gris-bleu sombre, pièces d'accent en acier clair poli
        scale_tex = plain_metal(seed + 1, (0.20, 0.21, 0.24), 0.30, metal=0.97, grain=0.08)
        gold_tex = plain_metal(seed + 2, (0.62, 0.64, 0.68), 0.20, metal=1.0, grain=0.04)
    armor_tex = plain_metal(seed + 3, (0.34, 0.35, 0.38), 0.27, metal=0.97, grain=0.06)   # acier sombre poli
    th_leather, th_gold = thumb()
    under, lames, cscales, cglow = cuff_parts()
    blames, bscales = back_armor()
    hs = lambda parts: scaled(parts, HS)          # main agrandie
    pb, pr_, pg = pistons()
    sets = {"Leather": (hs(fingers() + th_leather + core()) + under, 55, pbr("glove_under", leather_tex)),
            "Armor": (hs(plates() + th_gold) + lames + pb, 40, pbr("dragon_armor", armor_tex)),
            "Scales": (hs(blames) + cscales, 40, pbr("dragon_scale_large", scale_tex)),
            "Gold": (pr_ + hs(knuckle_guard() + horns()) + ring(-0.208, -0.194, 0.003) + ring(-0.154, -0.146, 0.002) + ring(-0.112, -0.104, 0.002)
                     + ring(-0.074, -0.066, 0.002) + spines(), 45, pbr("dragon_gold", gold_tex)),
            "Core": (cglow + wrist_glow() + pg, 60, glow_material())}
    out = Path(out)
    for side in ("R", "L"):
        m = {}
        for name, (parts, crease, mat) in sets.items():
            parts = scaled(parts)
            if side == "L":
                parts = [(P * np.array([-1, 1, 1]), UV, F[:, ::-1]) for P, UV, F in parts]
            m[name] = (parts, crease, mat)
        name = f"dragon_gauntlet_{side}_hd.glb" if SKIN == "dragon" else f"gauntlet_{side}_hd.glb"
        kit.assemble(out / name, m)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
