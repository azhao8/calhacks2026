# Contact sheets of the screenshots, for reading many renders at once: python3 qa/ux/sheet.py [filter]
import sys, os, glob
from PIL import Image, ImageDraw
d = os.path.join(os.path.dirname(__file__), "out")
flt = sys.argv[1] if len(sys.argv) > 1 else ""
files = sorted(f for f in glob.glob(f"{d}/shots/*.png") if (("--" not in os.path.basename(f)) if flt == "base" else flt in os.path.basename(f)))
W, H, per = 250, 541, 6
os.makedirs(f"{d}/sheets", exist_ok=True)
for n in range(0, len(files), per):
    sheet = Image.new("RGB", (W * per, H + 22), "white")
    draw = ImageDraw.Draw(sheet)
    for i, f in enumerate(files[n:n + per]):
        im = Image.open(f)
        im = im.resize((W, int(im.height * W / im.width)))
        sheet.paste(im.crop((0, 0, W, H)), (i * W, 22))
        draw.text((i * W + 4, 4), os.path.basename(f)[:-4][:40], fill="black")
    sheet.save(f"{d}/sheets/{(flt or 'all')}-{n // per:02d}.png")
print(len(files), "shots")
