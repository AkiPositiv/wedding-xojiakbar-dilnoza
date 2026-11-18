#!/usr/bin/env python3
"""Черновой монтаж фильма «Красная нить».

Читает montage/edl.txt (порядок клипов, обрезка), собирает видео
1920x1080 30fps с плавным затуханием между всеми клипами.
Если есть музыка — подкладывает её с затуханием. В конце — реальные фото
(по 1.5 с с лёгким приближением), если папка с фото не пуста.

Запуск:  python3 montage/build.py
Папки:   film/clips/  — клипы (*.mp4)
         film/music/  — main.mp3 (один трек на весь фильм), chorus.mp3 (наложение припева, необязательно)
         film/photos/ — реальные фото для финала (*.jpg/*.png), необязательно
Результат: film/out/draft.mp4
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILM = os.path.join(ROOT, "film")
CLIPS = os.path.join(FILM, "clips")
MUSIC = os.path.join(FILM, "music")
PHOTOS = os.path.join(FILM, "photos")
OUT = os.path.join(FILM, "out")
TMP = os.path.join(OUT, "tmp")
EDL = os.path.join(ROOT, "montage", "edl.txt")

W, H, FPS = 1920, 1080, 30
XFADE = float(os.environ.get("XFADE", 0.7))  # затухание между всеми клипами, сек
PHOTO_SEC = 1.5      # длительность одного фото в финале
CHORUS_AT = 110.0    # припев «A Thousand Years» с 1:50 фильма
CHORUS_LEN = 45.0    # до 2:35
CHORUS_SRC = float(os.environ.get("CHORUS_SRC", 55))  # с какой секунды песни брать припев
MAIN_SRC = float(os.environ.get("MAIN_SRC", 0))       # с какой секунды брать основной трек
FADE = 5.0           # затухание музыки, сек


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit(f"ffmpeg failed: {' '.join(cmd[:6])} ...")
    return r.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "csv=p=0", path]).strip())


def norm(src, dst, start=None, end=None):
    """Привести клип к 1920x1080, 30fps, без звука, с обрезкой."""
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-i", src, "-an",
            "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,"
                   f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps={FPS},format=yuv420p,setsar=1",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", dst]
    run(cmd)


def photo_clip(src, dst):
    frames = int(PHOTO_SEC * FPS)
    vf = (f"scale={W*2}:{H*2}:force_original_aspect_ratio=decrease,"
          f"pad={W*2}:{H*2}:(ow-iw)/2:(oh-ih)/2:color=black,"
          f"zoompan=z='1+0.05*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
          f":d={frames}:s={W}x{H}:fps={FPS},format=yuv420p,setsar=1")
    run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", src, "-vf", vf,
         "-frames:v", str(frames), "-c:v", "libx264", "-crf", "18", dst])


def concat(files, dst):
    lst = dst + ".txt"
    with open(lst, "w") as f:
        for p in files:
            f.write(f"file '{p}'\n")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
         "-c", "copy", dst])


def xfade_chain(parts, dst):
    """Склеить части с растворением между ними."""
    if len(parts) == 1:
        os.replace(parts[0], dst)
        return
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for p in parts:
        cmd += ["-i", p]
    filt, offset, prev = [], 0.0, "[0:v]"
    for i in range(1, len(parts)):
        offset += duration(parts[i - 1]) - XFADE
        out = f"[x{i}]"
        filt.append(f"{prev}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}{out}")
        prev = out
    cmd += ["-filter_complex", ";".join(filt), "-map", prev,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", dst]
    run(cmd)


def read_edl():
    eras = []
    for raw in open(EDL, encoding="utf-8"):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            eras.append((line[1:-1], []))
            continue
        bits = line.split()
        name = bits[0]
        start = float(bits[1]) if len(bits) > 1 and bits[1] != "-" else None
        end = float(bits[2]) if len(bits) > 2 and bits[2] != "-" else None
        eras[-1][1].append((name, start, end))
    return eras


def add_music(video, dst):
    main = os.path.join(MUSIC, "main.mp3")
    chorus = os.path.join(MUSIC, "chorus.mp3")
    if not os.path.exists(main):
        os.replace(video, dst)
        print("Музыки нет (film/music/main.mp3) — собрано без звука.")
        return
    total = duration(video)
    inputs = ["-i", video, "-i", main]
    a_main = (f"[1:a]atrim={MAIN_SRC}:{MAIN_SRC + total},asetpts=PTS-STARTPTS,apad,atrim=0:{total},afade=t=in:d=2,"
              f"afade=t=out:st={max(total - FADE, 0):.2f}:d={FADE}")
    if os.path.exists(chorus) and total > CHORUS_AT + 5:
        inputs += ["-i", chorus]
        clen = min(CHORUS_LEN, total - CHORUS_AT)
        # основной трек приглушаем на время припева
        a_main += (f",volume='if(between(t,{CHORUS_AT},{CHORUS_AT + clen}),0.25,1)':eval=frame[m];"
                   f"[2:a]atrim={CHORUS_SRC}:{CHORUS_SRC + clen},asetpts=PTS-STARTPTS,afade=t=in:d={FADE},"
                   f"afade=t=out:st={clen - FADE:.2f}:d={FADE},adelay={int(CHORUS_AT * 1000)}:all=1[c];"
                   f"[m][c]amix=inputs=2:duration=first:normalize=0[a]")
    else:
        a_main += "[a]"
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", a_main,
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
         "-t", f"{total:.3f}", dst])


def main():
    os.makedirs(TMP, exist_ok=True)
    era_files, missing = [], []  # era_files: все клипы подряд, затухание между каждым
    for idx, (era, items) in enumerate(read_edl()):
        for name, start, end in items:
            src = os.path.join(CLIPS, name + ".mp4")
            if not os.path.exists(src):
                missing.append(name)
                continue
            dst = os.path.join(TMP, name + ".mp4")
            norm(src, dst, start, end)
            era_files.append(dst)

    photos = sorted(p for p in os.listdir(PHOTOS)
                    if p.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))) if os.path.isdir(PHOTOS) else []
    if photos:
        pc = []
        for i, p in enumerate(photos):
            dst = os.path.join(TMP, f"photo_{i:02d}.mp4")
            photo_clip(os.path.join(PHOTOS, p), dst)
            pc.append(dst)
        pf = os.path.join(TMP, "era_photos.mp4")
        concat(pc, pf)
        era_files.append(pf)

    silent = os.path.join(TMP, "silent.mp4")
    xfade_chain(era_files, silent)
    final = os.path.join(OUT, "draft.mp4")
    add_music(silent, final)
    print(f"Готово: {final}  ({duration(final):.1f} с)")
    if missing:
        print("Пропущены (ещё нет клипов):", ", ".join(missing))


if __name__ == "__main__":
    main()
