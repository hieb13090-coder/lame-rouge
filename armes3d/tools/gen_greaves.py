"""Jambières « Tourbillon » : bottes blindées jusqu'au genou avec réacteurs (conception originale) -> GLB, droite + gauche (miroir).
Genouillère bombée à pointe, jambière à lames cramoisies, bagues dorées, bloc réacteur dans le dos du mollet avec deux tuyères
à ailettes et palet braise émissif, tuyère de talon, fentes d'aération lumineuses.
Repère : Y en haut, pointe du pied vers +Z, origine = centre du genou (cheville à y = -0,46, semelle à y = -0,52). ~0,6 m de haut.
Usage : python3 gen_greaves.py <dossier>"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep, capsule_profile, taper_profile  # noqa: E402
import naginata_textures as NT  # noqa: E402
import gen_dragon_gauntlets as G  # noqa: E402  (matériaux partagés : métal uni, lueur braise)

H.SHIFT_Y = 0.0
TILT = np.radians(28)           # inclinaison des tuyères de mollet (vers le bas et l'arrière)

# profil de la jambe : y -> (demi-profondeur z, demi-largeur x, décalage z du centre)
KY = [0.10, 0.04, -0.06, -0.16, -0.26, -0.36, -0.46]
KZ = [0.072, 0.068, 0.062, 0.072, 0.060, 0.050, 0.045]
KX = [0.074, 0.070, 0.064, 0.070, 0.060, 0.052, 0.046]
KC = [0.0, 0.0, -0.004, -0.014, -0.010, -0.004, 0.0]


def interp(vals, y):
    return np.interp(y, KY[::-1], vals[::-1])


def leg_path(y0, y1, n, grow=0.0, power=2.6, caps=(False, False), rz_k=1.0, rx_k=1.0, C=56, vscale=0.12):
    y = np.linspace(y0, y1, n)
    zc = interp(KC, y)
    path = np.stack([np.zeros(n), y, zc], -1)
    rz = interp(KZ, y) * rz_k + grow
    rx = interp(KX, y) * rx_k + grow
    return sweep(path, rz, rx, C=C, vscale=vscale, power=power, up=(0, 0, 1), caps=caps)


def ring_loop(y, grow, tube=0.0042, n=60):
    a = np.linspace(0, 2 * np.pi, n)
    zc = float(interp(KC, y))
    rz = float(interp(KZ, y)) + grow
    rx = float(interp(KX, y)) + grow
    p = np.stack([rx * np.cos(a), np.full(n, y), zc + rz * np.sin(a)], -1)
    return sweep(p, tube, tube, C=14, vscale=0.05, up=(0, 1, 0))


def shell():
    return leg_path(0.10, -0.465, 70, power=2.4, caps=(True, True))


def lames():
    """Bandes à écailles cramoisies qui se recouvrent sur le mollet et le tibia."""
    out = []
    for i, y0 in enumerate(np.arange(-0.040, -0.37, -0.066)):
        g = 0.0045 + 0.0004 * i
        out += leg_path(y0, y0 - 0.082, 14, grow=g, power=2.8, caps=(True, True), C=64, vscale=0.08)
    return out


def crest():
    """Arête de tibia en acier, le long de l'avant."""
    n = 40
    y = np.linspace(0.015, -0.44, n)
    zc = interp(KC, y) + interp(KZ, y) + 0.010
    path = np.stack([np.zeros(n), y, zc], -1)
    prof = capsule_profile(n, 1.0)
    return sweep(path, 0.011 * prof + 0.0005, 0.016 * prof + 0.0005, C=20, vscale=0.1, power=2.4, up=(0, 0, 1), caps=(True, True))


def crest_glow():
    """Filet lumineux le long de l'arête du tibia."""
    n = 40
    y = np.linspace(-0.03, -0.40, n)
    zc = interp(KC, y) + interp(KZ, y) + 0.010
    path = np.stack([np.zeros(n), y, zc], -1)
    prof = capsule_profile(n, 1.0)
    return sweep(path, 0.0135 * prof, 0.0032 * prof, C=14, vscale=0.1, power=2.6, up=(0, 0, 1), caps=(True, True))


def fins():
    """Ailerons de stabilisation sur les flancs du bloc réacteur."""
    out = []
    for sgn in (1, -1):
        n = 18
        t = np.linspace(0, 1, n)
        path = np.stack([np.full(n, sgn * 0.104), -0.150 - 0.030 * t, -0.092 - 0.095 * t], -1)
        out += sweep(path, taper_profile(n, 0.055, 0.25, 1.2), np.full(n, 0.0042), C=12, vscale=0.05, power=2.4, up=(0, 1, 0), caps=(True, True))
    return out


def knee_cop():
    """Genouillère bombée à nervure centrale + pointe dorée ; cuvette de côté."""
    prof = [(0.000, 0.064), (0.010, 0.063), (0.024, 0.056), (0.038, 0.044), (0.048, 0.030), (0.054, 0.014), (0.056, 0.000)]
    parts = H.lathe(H.catmull(prof, 40), 56, scale_v=0.08, close_start=True, close_end=False)
    rot = lambda P: np.stack([P[:, 0] * 1.18, -P[:, 2] * 1.0 + 0.0, P[:, 1] * 1.0 + 0.060], -1) * np.array([1, 1, 1])
    parts = kit.xf(parts, rot)
    return parts


def knee_spike():
    n = 16
    path = np.stack([np.zeros(n), np.linspace(0.0, 0.0, n), np.linspace(0.108, 0.158, n)], -1)
    return sweep(path, taper_profile(n, 0.016, 0.0, 1.2), taper_profile(n, 0.016, 0.0, 1.2), C=20, vscale=0.05, up=(0, 1, 0), caps=(True, False))


def knee_flares():
    """Deux ailettes latérales de genouillère."""
    out = []
    for s in (1, -1):
        n = 20
        ctrl = [(s * 0.060, 0.0, 0.040), (s * 0.090, 0.0, 0.050), (s * 0.108, 0.002, 0.030), (s * 0.116, 0.006, 0.000)]
        p = H.catmull(ctrl, n)
        out += sweep(p, taper_profile(n, 0.012, 0.0, 1.0), taper_profile(n, 0.020, 0.0, 1.0), C=16, vscale=0.05, up=(0, 1, 0), caps=(True, False))
    return out


def housing():
    """Bloc réacteur plaqué dans le dos du mollet."""
    n = 36
    y = np.linspace(-0.030, -0.335, n)
    path = np.stack([np.zeros(n), y, np.full(n, -0.092)], -1)
    prof = capsule_profile(n, 1.0)
    return sweep(path, 0.032 * prof, 0.108 * prof, C=48, vscale=0.1, power=3.2, up=(0, 0, 1), caps=(True, True))


def housing_glow():
    """Fentes d'aération lumineuses sur les flancs du bloc."""
    out = []
    for s in (1, -1):
        for k in range(3):
            y0 = -0.075 - 0.032 * k
            n = 8
            path = np.stack([np.full(n, s * 0.1065), np.linspace(y0, y0 - 0.020, n), np.full(n, -0.094)], -1)
            out += sweep(path, 0.0105, 0.0022, C=14, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, True))
    return out


def nozzle_local():
    """Tuyère le long de -Y depuis l'origine : acier à ailettes, lèvre dorée, palet émissif. Renvoie (acier, or, braise)."""
    outer = [(0.000, 0.026), (-0.004, 0.034), (-0.022, 0.036), (-0.028, 0.031), (-0.060, 0.030), (-0.065, 0.035), (-0.078, 0.035), (-0.084, 0.030),
             (-0.110, 0.030), (-0.122, 0.034), (-0.134, 0.0385), (-0.140, 0.040)]
    inner = [(-0.140, 0.034), (-0.124, 0.030), (-0.108, 0.027), (-0.102, 0.015), (-0.101, 0.0)]
    prof = np.vstack([H.catmull(outer, 40), H.catmull(inner, 14)])
    rib = lambda u, k, y: 0.0014 * np.cos(2 * np.pi * 14 * u) * float(np.clip(1 - abs(y + 0.040) / 0.050, 0, 1))
    steel = H.lathe(prof, 64, scale_v=0.1, close_start=True, close_end=False, mod=rib)
    lip = [(-0.134, 0.0405), (-0.138, 0.0440), (-0.1445, 0.0435), (-0.1475, 0.0400), (-0.1435, 0.0372), (-0.137, 0.0375)]
    gold = H.lathe(lip, 48, scale_v=0.05, close_start=False, close_end=False)
    gold += H.lathe([(-0.060, 0.0306), (-0.0635, 0.0360), (-0.0700, 0.0360), (-0.0735, 0.0306)], 48, scale_v=0.05, close_start=False, close_end=False)
    puck = H.lathe([(-0.1050, 0.025), (-0.1090, 0.025)], 36, scale_v=0.05)
    # arrière de la cavité : disque lumineux + anneau de chaleur
    puck += H.lathe([(-0.0985, 0.0205), (-0.1020, 0.0205)], 36, scale_v=0.05)
    return steel, gold, puck


def place(parts, phi, scale, t):
    """Tuyère locale (axe vers -Y) : tourne autour de X de phi (bascule vers -Z), met à l'échelle, translate."""
    c, s = np.cos(phi), np.sin(phi)

    def fn(P):
        P = P * scale
        y = P[:, 1] * c - P[:, 2] * s
        z = P[:, 1] * s + P[:, 2] * c
        return np.stack([P[:, 0] + t[0], y + t[1], z + t[2]], -1)
    return kit.xf(parts, fn)


def nozzles():
    st, gd, gl = nozzle_local()
    S_, G_, C_ = [], [], []
    for x in (0.050, -0.050):
        S_ += place(st, TILT, 1.0, (x, -0.205, -0.118))
        G_ += place(gd, TILT, 1.0, (x, -0.205, -0.118))
        C_ += place(gl, TILT, 1.0, (x, -0.205, -0.118))
    S_ += place(st, np.radians(78), 0.80, (0.0, -0.482, -0.066))
    G_ += place(gd, np.radians(78), 0.80, (0.0, -0.482, -0.066))
    C_ += place(gl, np.radians(78), 0.80, (0.0, -0.482, -0.066))
    return S_, G_, C_


def boot():
    ctrl = [(0, -0.495, -0.065), (0, -0.502, 0.000), (0, -0.505, 0.080), (0, -0.499, 0.160), (0, -0.488, 0.235), (0, -0.478, 0.285)]
    n = 40
    p = H.catmull(ctrl, n)
    s = np.linspace(0, 1, n)
    h = np.interp(s, [0, 0.2, 0.5, 0.8, 1.0], [0.050, 0.054, 0.050, 0.040, 0.020])
    w = np.interp(s, [0, 0.2, 0.5, 0.8, 1.0], [0.050, 0.056, 0.058, 0.052, 0.028])
    out = sweep(p, h, w, C=40, vscale=0.1, power=2.6, up=(0, 1, 0), caps=(True, True))
    # protège-orteil : plaque supérieure
    q = p[22:38]
    m = len(q)
    prof = np.sin(np.linspace(0.05, 0.95, m) * np.pi) ** 0.3
    out += sweep(q + np.array([0, 0.003, 0]), (h[22:38] + 0.005) * prof, (w[22:38] + 0.004) * prof, C=36, vscale=0.08, power=3.0, up=(0, 1, 0), caps=(True, True))
    return out


def ankle_ring_parts():
    return [p for y in (0.075, -0.06, -0.19, -0.325, -0.44) for p in ring_loop(y, 0.0035)]


def build(out):
    seed = 303
    armor_tex = G.plain_metal(seed, (0.34, 0.35, 0.38), 0.27, metal=0.97, grain=0.06)
    scale_tex = NT.dragon_scale_textures(seed + 1, cells=12)
    gold_tex = NT.gilt_textures(seed + 2, tint=(0.86, 0.62, 0.20))
    n_st, n_gd, n_gl = nozzles()
    armor = shell() + crest() + housing() + knee_cop() + boot() + fins() + n_st
    gold = knee_spike() + knee_flares() + ankle_ring_parts() + n_gd
    core = housing_glow() + crest_glow() + n_gl
    sets = {"Armor": (armor, 40, pbr("tourbillon_armor", armor_tex)),
            "Scales": (lames(), 40, pbr("tourbillon_scales", scale_tex)),
            "Gold": (gold, 45, pbr("tourbillon_gold", gold_tex)),
            "Core": (core, 60, G.glow_material())}
    out = Path(out)
    for side in ("R", "L"):
        m = {}
        for name, (parts, crease, mat) in sets.items():
            if side == "L":
                parts = [(P * np.array([-1, 1, 1]), UV, F[:, ::-1]) for P, UV, F in parts]
            m[name] = (parts, crease, mat)
        kit.assemble(out / f"greaves_{side}_hd.glb", m)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
