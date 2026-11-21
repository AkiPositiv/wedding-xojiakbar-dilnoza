#!/usr/bin/env python3
"""Трейлер «Красная нить» (~55 с): быстрые склейки лучших моментов, надписи, титул.

Берёт нормализованные клипы из film/out/tmp (их готовит montage/build.py),
музыку — финал «Heart of Courage» (film/music/heart_of_courage.mp3).
Результат: film/out/trailer.mp4
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = os.path.join(ROOT, "film", "out", "tmp")
OUT = os.path.join(ROOT, "film", "out")
WORK = os.path.join(OUT, "trailer_tmp")
MUSIC = os.path.join(ROOT, "film", "music", "heart_of_courage.mp3")
MUSIC_START = float(os.environ.get("TRAILER_MUSIC_START", 139))  # кульминация и естественный финал трека

W, H, FPS = 1920, 1080, 30
FONT_UZ = "/usr/share/fonts/opentype/inter/InterDisplay-Light.otf"
FONT_RU = "/usr/share/fonts/opentype/inter/InterDisplay-ExtraLight.otf"
FONT_TITLE = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"

# ("clip", имя, начало, длительность) | ("card", узбекский, русский, длительность) | ("title", ...)
PLAN = [
    ("card", "Aytishlaricha, sevgi vaqtdan kuchli", "Говорят, любовь сильнее времени", 2.6),
    ("clip", "00_2_Nit", 1.0, 2.0),
    ("clip", "01_1_On_vidit", 1.5, 2.5),
    ("clip", "01_3_Vihr", 1.0, 2.0),
    ("card", "U uni har bir davrda izladi", "Он искал её в каждой эпохе", 2.2),
    ("clip", "02_2_Cvetok", 2.0, 2.0),
    ("clip", "04_2_Princessa", 3.0, 2.5),
    ("clip", "05_3_Reshetka", 4.5, 2.0),
    ("clip", "06_2_Vzglyady", 3.0, 2.5),
    ("clip", "07_3_Pod_maskoy", 2.0, 2.5),
    ("card", "…va har safar yoʻqotdi", "…и каждый раз терял", 2.2),
    ("clip", "08_3_Roza", 0.0, 2.0),
    ("clip", "09_3_Ruki", 2.0, 2.5),
    ("clip", "10_2_Na_stene", 2.0, 2.5),
    ("clip", "T08_Roza", 2.0, 2.5),
    ("card", "Ammo ip uzilmaydi", "Но нить не рвётся", 2.2),
    ("clip", "11_4_Perehod", 2.0, 3.0),
    ("clip", "12_4_Tennis", 1.5, 2.0),
    ("clip", "12_5_Basketbol", 3.0, 2.0),
    ("clip", "12_7_Komanda", 2.0, 2.0),
    ("clip", "13_1_Nit", 2.0, 4.0),
    ("title", "T06_Lenta", 0.0, 6.0),
]


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit("ffmpeg failed")
    return r.stdout


def textfile(name, text):
    p = os.path.join(WORK, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return p


def fade_alpha(d, fi=0.4, fo=0.4):
    return (f"if(lt(t,{fi}),t/{fi},if(gt(t,{d - fo}),({d}-t)/{fo},1))")


def clip(i, name, start, dur):
    dst = os.path.join(WORK, f"{i:02d}.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-ss", str(start), "-t", str(dur),
         "-i", os.path.join(TMP, name + ".mp4"), "-an",
         "-vf", f"fps={FPS},format=yuv420p,setsar=1",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16", dst])
    return dst


def card(i, uz, ru, dur):
    dst = os.path.join(WORK, f"{i:02d}.mp4")
    a = fade_alpha(dur)
    tu, tr = textfile(f"{i:02d}_uz.txt", uz), textfile(f"{i:02d}_ru.txt", ru)
    vf = (f"drawtext=fontfile={FONT_UZ}:textfile={tu}:fontsize=70:fontcolor=white:"
          f"x=(w-text_w)/2:y=h/2-90:alpha='{a}',"
          f"drawtext=fontfile={FONT_RU}:textfile={tr}:fontsize=44:fontcolor=0xD8D8D8:"
          f"x=(w-text_w)/2:y=h/2+20:alpha='{a}',format=yuv420p,setsar=1")
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}:d={dur}",
         "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "16", dst])
    return dst


def title(i, bg, start, dur):
    dst = os.path.join(WORK, f"{i:02d}.mp4")
    t1 = textfile("t_uz.txt", "Q I Z I L   I P")
    t2 = textfile("t_ru.txt", "К Р А С Н А Я   Н И Т Ь")
    t3 = textfile("t_names.txt", "Xojiakbar  &  Dilnoza")
    a1 = f"if(lt(t,0.8),0,if(lt(t,1.8),t-0.8,if(gt(t,{dur - 0.8}),({dur}-t)/0.8,1)))"
    a2 = f"if(lt(t,1.6),0,if(lt(t,2.6),t-1.6,if(gt(t,{dur - 0.8}),({dur}-t)/0.8,1)))"
    vf = (f"fps={FPS},gblur=sigma=14,eq=brightness=-0.18:saturation=1.1,"
          f"drawtext=fontfile={FONT_TITLE}:textfile={t1}:fontsize=150:fontcolor=0xE0303A:"
          f"x=(w-text_w)/2:y=h/2-170:alpha='{a1}':shadowcolor=black@0.6:shadowx=0:shadowy=4,"
          f"drawtext=fontfile={FONT_RU}:textfile={t2}:fontsize=54:fontcolor=white:"
          f"x=(w-text_w)/2:y=h/2+10:alpha='{a1}',"
          f"drawtext=fontfile={FONT_UZ}:textfile={t3}:fontsize=58:fontcolor=0xF2E6C9:"
          f"x=(w-text_w)/2:y=h/2+130:alpha='{a2}',"
          f"fade=t=out:st={dur - 0.6}:d=0.6,format=yuv420p,setsar=1")
    run(["ffmpeg", "-y", "-v", "error", "-ss", str(start), "-t", str(dur),
         "-i", os.path.join(TMP, bg + ".mp4"), "-an", "-vf", vf,
         "-c:v", "libx264", "-preset", "medium", "-crf", "16", dst])
    return dst


def main():
    os.makedirs(WORK, exist_ok=True)
    parts = []
    for i, item in enumerate(PLAN):
        kind = item[0]
        if kind == "clip":
            parts.append(clip(i, *item[1:]))
        elif kind == "card":
            parts.append(card(i, *item[1:]))
        else:
            parts.append(title(i, *item[1:]))
    lst = os.path.join(WORK, "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    silent = os.path.join(WORK, "silent.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])
    total = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                       "-of", "csv=p=0", silent]).strip())
    out = os.path.join(OUT, "trailer.mp4")
    af = (f"[1:a]atrim={MUSIC_START}:{MUSIC_START + total},asetpts=PTS-STARTPTS,apad,atrim=0:{total},"
          f"afade=t=in:d=1.2,afade=t=out:st={total - 3}:d=3[a]")
    run(["ffmpeg", "-y", "-v", "error", "-i", silent, "-i", MUSIC, "-filter_complex", af,
         "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
         "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "-t", f"{total:.3f}", out])
    print(f"Готово: {out} ({total:.1f} с)")


if __name__ == "__main__":
    main()
