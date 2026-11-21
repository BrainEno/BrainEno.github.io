import sys, os, subprocess
from pathlib import Path
from PIL import Image
import imageio_ffmpeg
slug=sys.argv[1]; frames=Path(os.environ['CAPTURE_OUT']); out=Path('media');out.mkdir(exist_ok=True)
for name,n in [('poster',70 if slug=='win7-book-management' else 102 if slug=='scribeforge' else 119),('detail',18)]:
 im=Image.open(frames/f'{n:04}.png').convert('RGB'); im.thumbnail((1280,960)); im.save(out/f'{slug}-{name}.webp', quality=82, method=6)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-loglevel','error','-framerate','10','-i',str(frames/'%04d.png'),'-vf',"scale='min(1120,iw)':-2",'-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(out/f'{slug}.mp4')],check=True)
