# python sheet.py video.mp4 out.png start_s end_s fps [width] [cols]
import sys, subprocess, tempfile, os, glob
import imageio_ffmpeg
from PIL import Image, ImageDraw
v, out, a, b, fps = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
w = int(sys.argv[6]) if len(sys.argv) > 6 else 180
cols = int(sys.argv[7]) if len(sys.argv) > 7 else 8
crop = sys.argv[8] if len(sys.argv) > 8 else None  # 'x:y:w:h' in source pixels
ff = imageio_ffmpeg.get_ffmpeg_exe()
d = tempfile.mkdtemp()
subprocess.run([ff, '-v', 'error', '-ss', str(a), '-to', str(b), '-i', v, '-vf', (f'fps={fps},crop={crop},scale={w}:-1' if crop else f'fps={fps},scale={w}:-1'), os.path.join(d, 'f%04d.png')], check=True)
fs = sorted(glob.glob(os.path.join(d, 'f*.png')))
ims = [Image.open(f) for f in fs]
if not ims: sys.exit('no frames')
fw, fh = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * fw, rows * (fh + 16)), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols) * fw, (i // cols) * (fh + 16)
    sheet.paste(im, (x, y + 16))
    dr.text((x + 4, y + 2), f'{a + i / fps:.2f}s', fill=(230, 230, 230))
sheet.save(out)
print(out, len(ims), sheet.size)
