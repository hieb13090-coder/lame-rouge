import json, numpy as np, cv2
im = cv2.imread('/mnt/user-data/uploads/1d90086f-image.png')
H, W = im.shape[:2]
b, g, r = [im[:, :, i].astype(int) for i in range(3)]
green = ((g > 170) & (r < 120) & (b < 120)).astype(np.uint8)
lum = 0.114*b + 0.587*g + 0.299*r

def seg(x0, x1, y0, y1, bgL, bgR, thr=28, keep_green=True):
    m = np.zeros((H, W), np.uint8)
    for y in range(y0, y1):
        bl = np.median(lum[y, bgL[0]:bgL[1]]); br = np.median(lum[y, bgR[0]:bgR[1]])
        bg = np.linspace(bl, br, x1 - x0)
        m[y, x0:x1] = np.abs(lum[y, x0:x1] - bg) > thr
    if keep_green: m = np.maximum(m, green)
    m[:, :x0] = 0; m[:, x1:] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(m); cv2.drawContours(out, cs, -1, 1, -1)
    return out

front = seg(22, 112, 8, 252, (8, 16), (118, 126))
side = seg(246, 331, 8, 192, (238, 245), (238, 245), keep_green=False)

def span(m, y):
    xs = np.where(m[y])[0]
    return (xs.min(), xs.max() + 1) if len(xs) else (None, None)

fy0, fy1 = 17, 251            # haut/bas de la botte, vue de face
sy0, sy1 = 18, 189            # haut/bas, vue latérale
sf, ss = 10 / (fy1 - fy0), 10 / (sy1 - sy0)
xc = np.mean([sum(span(front, y)) / 2 for y in range(60, 130)])
# z=0 : axe du fût à mi-hauteur
yr = int(round(sy1 - 5 / ss)); zl, zr = span(side, yr); zref = (zl + zr) / 2

N = 51
rows = []
for i in range(N):
    y = i * 10 / (N - 1)
    pf = int(round(fy1 - y / sf)); ps = int(round(sy1 - y / ss))
    pf = min(max(pf, fy0 + 1), fy1 - 1); ps = min(max(ps, sy0 + 1), sy1 - 1)
    xl, xr = span(front, pf); zl, zr = span(side, ps)
    rows.append([y, (xr - xl) / 2 * sf, (zr - zl) / 2 * ss, ((zl + zr) / 2 - zref) * ss,
                 ((xl + xr) / 2 - xc) * sf])
A = np.array(rows)
k = np.array([1, 2, 1]) / 4
for col in (1, 2, 3):
    A[1:-1, col] = np.convolve(A[:, col], k, mode='valid')
# coupe du col (vue latérale) : hauteur du haut de silhouette par colonne
cols = {}
for x in range(260, 312, 4):
    ys = np.where(side[:, x])[0]
    cols[x] = (sy1 - ys.min()) * ss
xs = np.array(list(cols)); hs = np.array(list(cols.values()))
zs = (xs - zref) * ss
slope, icpt = np.polyfit(zs, hs, 1)
# bout du pied et talon
zmin = (np.where(side.any(0))[0].min() - zref) * ss; zmax = (np.where(side.any(0))[0].max() + 1 - zref) * ss
# trait vert : intérieur rempli, érodé de l'épaisseur du trait
gm = green.copy(); gm[:, 120:] = 0
cs, _ = cv2.findContours(cv2.morphologyEx(gm, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cnt = max(cs, key=cv2.contourArea)
filled = np.zeros_like(gm); cv2.drawContours(filled, [cnt], -1, 1, -1)
inner = cv2.erode(filled, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
ys = np.where(inner.any(1))[0]
plate = []
for y in range(ys.min(), ys.max() + 1, 2):
    xs_ = np.where(inner[y])[0]
    plate.append([(fy1 - y) * sf, (xs_.min() - xc) * sf, (xs_.max() + 1 - xc) * sf])
out = dict(sf=sf, ss=ss, rows=A.round(4).tolist(), cut_slope=float(slope), cut_icpt=float(icpt),
           zmin=float(zmin), zmax=float(zmax), plate=np.array(plate).round(4).tolist())
json.dump(out, open('ref.json', 'w'))
print('xc', xc, 'zref', zref, 'sf', round(sf, 4), 'ss', round(ss, 4))
print('cut slope', round(slope, 3), 'icpt', round(icpt, 2), 'zmin/zmax', round(zmin, 2), round(zmax, 2))
print('rows (y,a,b,c,xoff):'); [print(np.round(r, 2)) for r in A[::5]]
print('plate y from', round(plate[0][0], 2), 'to', round(plate[-1][0], 2), 'rows', len(plate))
for p in plate[::6]: print(np.round(p, 2))
dbg = np.zeros((260, 360, 3), np.uint8) + 60
dbg[front[:260, :360] > 0] = (200, 120, 0); dbg[side[:260, :360] > 0] = (0, 160, 200)
dbg[inner[:260, :360] > 0] = (0, 255, 0)
cv2.imwrite('masks.png', cv2.resize(dbg, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST))
