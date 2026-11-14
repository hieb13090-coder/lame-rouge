"""Planche contact des armes : python3 tools/contact_sheet.py previews/planche_armes.jpg"""
import sys
from PIL import Image, ImageDraw, ImageFont
import numpy as np

LIST = [("Katana « Yugiri »", "katana_hero"), ("Épée longue « Aurore »", "sword_epic_hero"),
        ("Épée de feu « Brasier »", "fire_hero"), ("Claymore « Tempête »", "claymore_hero"),
        ("Épée volante « Plume »", "flying_sword_hero"), ("Dague « Vipère »", "dagger_hero"),
        ("Couteau « Éclat »", "knife_hero"), ("Marteau « Brise-Monts »", "hammer_hero"),
        ("Hache « Fendeur »", "axe_hero"), ("Naginata « Tsukikage »", "naginata_hero"),
        ("Bô « Gardien »", "bo_hero"), ("Gantelet « Poings-Wyrm »", "gauntlet_R_hero")]
CW, CH, COLS = 420, 460, 4


def crop(im):
    a = np.asarray(im.convert("L")).astype(int)
    m = a > 22
    ys, xs = np.where(m)
    if len(xs) == 0:
        return im
    pad = 12
    return im.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, im.width), min(ys.max() + pad, im.height)))


def main(out):
    rows = (len(LIST) + COLS - 1) // COLS
    sheet = Image.new("RGB", (CW * COLS, CH * rows), (8, 9, 12))
    d = ImageDraw.Draw(sheet)
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except Exception:
        f = ImageFont.load_default()
    for i, (name, stem) in enumerate(LIST):
        try:
            im = crop(Image.open(f"previews/{stem}.png").convert("RGB"))
        except FileNotFoundError:
            continue
        k = min((CW - 30) / im.width, (CH - 80) / im.height)
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        x, y = (i % COLS) * CW, (i // COLS) * CH
        sheet.paste(im, (x + (CW - im.width) // 2, y + 20 + (CH - 80 - im.height) // 2))
        d.text((x + 20, y + CH - 40), name, fill=(215, 205, 190), font=f)
    sheet.save(out, quality=88)
    print("planche ->", out, sheet.size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "previews/planche_armes.jpg")
