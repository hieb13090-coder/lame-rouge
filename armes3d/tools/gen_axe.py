"""Hache de guerre « Fendeur » (à barbe) -> GLB. Tête d'acier à joues creusées, tranchant poli, filets de cuivre incrustés,
douille rivetée, pointe de dos, manche de frêne ovale à prise de cuir cordée, languettes d'acier rivetées, talon à culot de fer.
~1,02 m. Repère : manche le long de Y, tranchant vers +X, origine = centre de la prise. Usage : python3 gen_axe.py <dossier>"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import H, pbr, sweep  # noqa: E402
import forge_tex as FT  # noqa: E402
import sword_textures as TX  # noqa: E402
import gen_bo as BO  # noqa: E402
from sword_textures import fbm  # noqa: E402

sst = H.smoothstep
Y_BUTT, Y_TOP = -0.54, 0.50
YC = 0.405                         # centre de la tête
YM, HH, HHD = YC - 0.010, 0.125, 0.205   # tête : milieu, demi-hauteur côté pointe, côté barbe
XB = 0.020                         # bord intérieur (caché par la douille)
GRIP_C = -0.26
H.SHIFT_Y = -GRIP_C
N = 40


# ------------------------------------------------------------------ manche
def haft_path(n=120):
    y = np.linspace(Y_BUTT, Y_TOP, n)
    x = 0.010 * np.sin(np.pi * (y - Y_BUTT) / (Y_TOP - Y_BUTT) * 1.0) * np.sin(np.pi * 1.6 * (y - Y_BUTT) / (Y_TOP - Y_BUTT))
    return np.stack([x, y, np.zeros(n)], -1), y


def haft_radii(y):
    s = (y - Y_BUTT) / (Y_TOP - Y_BUTT)
    swell = 0.0050 * np.exp(-((y - (Y_BUTT + 0.045)) / 0.050) ** 2)
    base = 0.0152 + 0.0032 * sst(0.60, 1.0, s)
    cap = np.where(y > Y_TOP - 0.01, 1.0, 1.0)
    return (base + swell) * cap


def haft_parts():
    path, y = haft_path()
    r = haft_radii(y)
    return sweep(path, r * 0.86, r * 1.18, C=36, vscale=1.04, up=(0, 0, 1), caps=(True, True))


def grip_parts():
    y0, y1 = -0.095, -0.425
    n = 140
    path, yy = haft_path(400)
    sel = (yy < y0) & (yy > y1)
    seg = path[sel]
    ys = yy[sel][:n * 3 // 3]
    r = haft_radii(ys)
    m = len(seg)
    s = np.linspace(0, 1, m)
    swell = 0.0012 + 0.0022 * np.minimum(1, np.minimum(s, 1 - s) / 0.03) ** 0.5

    def weave(u, k):
        a = 0.5 + 0.5 * np.cos(2 * np.pi * (9 * u + k / 7.0))
        b = 0.5 + 0.5 * np.cos(2 * np.pi * (9 * u - k / 7.0))
        return 0.0012 * np.maximum(a, b) ** 1.4 - 0.0005
    return sweep(seg, (r + swell) * 0.86, (r + swell) * 1.18, C=52, vscale=0.33, up=(0, 0, 1), caps=(True, True), delta=weave)


def butt_parts():
    """Culot de fer : douille, bague, pointe courte."""
    path, y = haft_path()
    i1 = np.searchsorted(y, Y_BUTT + 0.075)
    seg = path[:i1]
    ys = y[:i1]
    n = len(seg)
    r = haft_radii(ys)
    t = np.linspace(0, 1, n)
    cap = np.sqrt(np.clip(1 - ((1 - t) / 0.18) ** 2, 0, 1)) * (t < 0.18) + (t >= 0.18)
    out = sweep(seg, (r + 0.0020) * 0.86 * cap, (r + 0.0020) * 1.18 * cap, C=48, vscale=0.08, up=(0, 0, 1), caps=(True, True))
    # pointe : cône court sous le culot
    p0 = path[0] + np.array([0, -0.004, 0])
    cone = np.stack([np.full(14, p0[0]), p0[1] - np.linspace(0, 0.050, 14), np.zeros(14)], -1)
    rr = 0.0105 * (1 - np.linspace(0, 1, 14)) ** 0.8
    out += sweep(cone, rr, rr, C=28, vscale=0.05, up=(0, 0, 1), caps=(True, True))
    return out


# ------------------------------------------------------------------ tête
def sval(y):
    y = np.asarray(y, float)
    return np.where(y < YM, (y - YM) / HHD, (y - YM) / HH)


def x_edge(y):
    s = sval(y)
    c = np.cos(np.pi / 2 * np.clip(s, -1, 1)) ** 0.60
    return XB + 0.225 * c + 0.115 * np.clip(-s, 0, 1) ** 2.6 + 0.020 * np.clip(s, 0, 1) ** 2.6


def x_back(y):
    s = sval(y)
    return XB + 0.105 * np.clip(-s, 0, 1) ** 2.0 + 0.060 * np.clip(s, 0, 1) ** 2.0


def z_top(f, y):
    """Demi-épaisseur à la fraction f (0 = dos, 1 = tranchant) : joue creusée, biseau de tranchant."""
    s = sval(y)
    env = np.clip(1 - np.abs(s) ** 6, 0, 1) ** 0.5
    body = 0.0038 + 0.0072 * (1 - f) ** 1.15
    dish = 0.0034 * np.sin(np.pi * np.clip((f - 0.10) / 0.62, 0, 1)) ** 1.2 * (1 - sst(0.80, 0.98, np.abs(s)))
    wl = np.clip((f - 0.84) / 0.16, 0, 1)
    z = (body - dish) * (1 - wl) + 0.0004 * wl
    return np.maximum(z, 0.0004) * env + 0.0002


def head_parts():
    t1 = np.linspace(0, 1, 70)
    lo = YM - HHD * np.cos(t1 * np.pi / 2)             # dense near the beard tip
    t2 = np.linspace(0, 1, 56)[1:]
    hi = YM + HH * np.sin(t2 * np.pi / 2)
    ys = np.concatenate([lo, hi])
    ys[0] += 1e-4
    ys[-1] -= 1e-4
    fs = np.linspace(1, 0, N)
    rings = np.zeros((len(ys), 2 * N, 3))
    for k, y in enumerate(ys):
        xe, xb = x_edge(y), x_back(y)
        f = np.concatenate([fs, fs[::-1]])
        x = xb + (xe - xb) * f
        z = z_top(f, y)
        z = np.where(np.arange(2 * N) < N, z, -z)
        rings[k] = np.stack([x, np.full(2 * N, y), z], -1)
    C = 2 * N
    U = np.repeat((np.arange(C + 1) / C)[None, :], len(ys), axis=0)
    P, UV, F = H.grid_surface(rings, U, (ys - ys[0]) / (ys[-1] - ys[0]))
    return [(P, UV, F), H.cap(rings[0], (0, -1, 0)), H.cap(rings[-1], (0, 1, 0))]


def head_texture(seed, W=512, Ht=2048):
    rng = np.random.default_rng(seed)
    C = 2 * N
    u = (np.arange(W) + 0.5) / W
    v = 1 - (np.arange(Ht) + 0.5) / Ht
    idx = u * C
    f = np.where(idx < N, 1 - np.clip(idx, 0, N - 1) / (N - 1), np.clip(idx - N, 0, N - 1) / (N - 1))[None, :] * np.ones((Ht, 1))
    yy = ((YM - HHD) + v * (HH + HHD))[:, None] * np.ones((1, W))
    s = sval(yy)
    hammer = fbm((Ht, W), (60, 20), rng, octs=4, tile=False)
    brush = fbm((Ht, W), (600, 8), rng, octs=3, tile=False)
    mott = fbm((Ht, W), (30, 6), rng, octs=5, tile=False)
    pt = FT.pits((Ht, W), rng, 1000)
    scr = np.asarray(TX.scratches((Ht, W), rng, 220, along_rows=False, length=(40, 500), spread=0.3, cross=40), np.float32)
    scr = scr / max(scr.max(), 1e-6)
    # arêtes parallèles au tranchant : on lit la distance au bord via f et la courbe x_edge
    bevel = sst(0.86, 0.93, f)
    fil = np.exp(-((f - 0.745) / 0.010) ** 2) + np.exp(-((f - 0.325) / 0.008) ** 2)          # filets incrustés (cuivre)
    zone = sst(0.37, 0.40, f) * (1 - sst(0.69, 0.72, f))
    la = np.cos(2 * np.pi * (13 * s + 6 * f))
    lb = np.cos(2 * np.pi * (13 * s - 6 * f))
    gravure = np.clip(la ** 8 + lb ** 8, 0, 1) * zone * (1 - sst(0.75, 0.93, np.abs(s)))
    nick = np.zeros((Ht, W), np.float32)
    for vy in rng.uniform(0.2, 0.9, 14):
        r0 = int((1 - vy) * Ht)
        ln = int(rng.integers(2, 5))
        nick[max(0, r0 - ln):r0 + ln] = 1.0
    nick = nick * sst(0.90, 0.97, f) * sst(0.0, 0.5, rng.random((Ht, 1)))

    lum = 0.27 + 0.05 * (hammer - 0.5) + 0.03 * (mott - 0.5) + 0.04 * scr - 0.07 * pt
    lum = lum * (1 - bevel) + bevel * (0.66 + 0.04 * (brush - 0.5))
    lum = lum - 0.12 * gravure - 0.25 * nick
    base = np.stack([lum * 0.97, lum, lum * 1.03], -1)
    cu = np.array([0.74, 0.40, 0.19])[None, None, :]
    fm = np.clip(fil, 0, 1)[..., None]
    base = base * (1 - fm) + cu * fm
    r = 0.38 + 0.08 * (mott - 0.5) - 0.06 * scr + 0.30 * pt + 0.12 * gravure
    r = r * (1 - bevel) + bevel * 0.16
    r = r * (1 - fm[..., 0]) + 0.30 * fm[..., 0] + 0.30 * nick
    h = 0.10 * hammer + 0.05 * brush - 0.5 * pt - 0.6 * gravure - 0.9 * nick - 0.4 * scr - 0.35 * np.clip(fil, 0, 1)
    return dict(base=TX.to_img(base), mr=TX.mr_map(np.clip(r, 0.1, 0.95), np.ones((Ht, W), np.float32)), normal=TX.normal_map(h, 3.0))


def socket_parts():
    n = 60
    ys = np.linspace(YC - 0.085, YC + 0.085, n)
    s = (ys - (YC - 0.085)) / 0.17
    path, yh = haft_path(400)
    px = np.interp(ys, yh, path[:, 0])
    rx = 0.0225 + 0.0030 * np.clip(np.sin(np.pi * s), 0, 1) ** 0.6 - 0.002 * (1 - sst(0.0, 0.1, s)) - 0.002 * sst(0.9, 1.0, s)
    ry = 0.0295 + 0.0035 * np.clip(np.sin(np.pi * s), 0, 1) ** 0.6
    out = sweep(np.stack([px, ys, np.zeros(n)], -1), rx, ry, C=56, vscale=0.17, power=3.0, up=(0, 0, 1), caps=(True, True))
    for yb in (YC - 0.082, YC + 0.082):                         # bourrelets
        q = np.stack([np.interp([yb - 0.006, yb, yb + 0.006], yh, path[:, 0]), [yb - 0.006, yb, yb + 0.006], [0, 0, 0]], -1)
        out += sweep(q, np.array([0.0215, 0.0250, 0.0215]), np.array([0.0285, 0.0325, 0.0285]), C=56, vscale=0.05, power=3.0, up=(0, 0, 1), caps=(True, True))
    return out


def spike_parts():
    n = 50
    t = np.linspace(0, 1, n)
    path = np.stack([-0.020 - 0.150 * t, YC + 0.004 + 0.030 * t ** 2.0, np.zeros(n)], -1)
    rz = 0.0150 * (1 - t) ** 0.9 + 0.0012
    ry = 0.0215 * (1 - t) ** 0.8 + 0.0012
    rz = rz * np.clip(1 - sst(0.96, 1.0, t), 0, 1) ** 0.5
    ry = ry * np.clip(1 - sst(0.96, 1.0, t), 0, 1) ** 0.5
    return sweep(path, rz, ry, C=32, vscale=0.15, power=2.8, up=(0, 0, 1), caps=(True, True))


def dome(c, axis, sign, r, h, n=36):
    prof = H.catmull([(0.0, r), (0.35 * h, 0.92 * r), (0.75 * h, 0.62 * r), (h, 0.0)], 14)
    parts = H.lathe(prof, n, scale_v=0.02, close_start=True, close_end=False)
    out = []
    for P, UV, F in parts:
        if axis == "z":
            Q, det = np.stack([P[:, 0], P[:, 2], P[:, 1] * sign], -1), -1
        else:
            Q, det = np.stack([P[:, 1] * sign, P[:, 0], P[:, 2]], -1), -1
        out.append((Q + np.asarray(c)[None], UV, F[:, ::-1] if det * sign > 0 else F))
    return out


def rivet_parts():
    out = []
    for sg in (1, -1):
        for dy in (-0.058, -0.020, 0.020, 0.058):
            out += dome((0.0, YC + dy, sg * 0.0258), "z", sg, 0.0062, 0.0050)
            out += dome((0.0, YC + dy, sg * 0.0258), "z", sg, 0.0062, 0.0050)[:0]
    return out


def langet_parts():
    out, rivets = [], []
    path, y = haft_path(400)
    sel = (y > YC - 0.40) & (y < YC - 0.080)
    seg = path[sel]
    ys = y[sel]
    n = len(seg)
    t = np.linspace(0, 1, n)
    for sg in (1, -1):
        r = haft_radii(ys)
        off = np.stack([seg[:, 0] + sg * (r * 1.18 + 0.0014), seg[:, 1], np.zeros(n)], -1)
        wd = 0.0088 * (0.55 + 0.45 * sst(0.0, 0.25, t)) * np.clip(1 - sst(0.92, 1.0, t), 0, 1) ** 0.5
        out += sweep(off, wd, 0.0018, C=14, vscale=0.05, power=2.4, up=(0, 0, 1), caps=(True, True))
        for ti in (0.12, 0.34, 0.56, 0.78):
            i = int(ti * (n - 1))
            rivets += dome((off[i][0] + sg * 0.0012, off[i][1], 0.0), "x", sg, 0.0050, 0.0042)
    return out, rivets


def build(out):
    seed = 161
    head = head_texture(seed)
    steel = FT.dark_steel(seed + 1, lum=0.30, rough=0.40)
    ash = BO.wood_tex(seed + 2, tint=(0.46, 0.33, 0.19))
    leather = FT.grip_leather(seed + 3, color=(0.115, 0.060, 0.036), stitch=(0.30, 0.20, 0.10))
    lang, lrv = langet_parts()
    sets = {"Head": (head_parts(), 28, pbr("axe_head", head)),
            "Iron": (socket_parts() + spike_parts() + butt_parts() + lang + rivet_parts() + lrv, 40, pbr("axe_iron", steel)),
            "Haft": (haft_parts(), 30, pbr("axe_ash", ash)),
            "Grip": (grip_parts(), 55, pbr("axe_leather", leather))}
    return kit.assemble(Path(out) / "axe_hd.glb", sets)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
