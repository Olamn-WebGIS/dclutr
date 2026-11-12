"""Render the 15-second D_clutr vertical ad to public/d-clutr-campus-ad.mp4.

Requires Pillow, NumPy, and FFmpeg. All graphics and audio are original.
"""

from __future__ import annotations

import math
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "d-clutr-campus-ad.mp4"
WIDTH, HEIGHT, FPS, DURATION = 720, 1280, 30, 15
PAPER = "#F8F7F1"
WHITE = "#FFFEFA"
FOREST = "#244B39"
FOREST_DARK = "#183B2C"
INK = "#203B2E"
SAGE = "#DCE7D9"
SAGE_MID = "#A8BDA8"
MUTED = "#718071"
SAND = "#D9C18F"
LINE = "#E6E7DC"
CLAY = "#C88366"
LILAC = "#DAD2E5"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    windows_fonts = Path(r"C:\Windows\Fonts")
    candidates = {
        "serif": ("georgiab.ttf", "Georgia.ttf"),
        "serif_regular": ("georgia.ttf",),
        "sans": ("arial.ttf",),
        "sans_bold": ("arialbd.ttf",),
    }
    for candidate in candidates[name]:
        path = windows_fonts / candidate
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.truetype(candidates[name][0], size)


def smooth(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def text(
    draw: ImageDraw.ImageDraw,
    point: tuple[int, int],
    value: str,
    size: int,
    color: str = INK,
    face: str = "sans",
    anchor: str = "la",
    spacing: int = 8,
) -> None:
    draw.multiline_text(
        point,
        value,
        font=font(face, size),
        fill=color,
        anchor=anchor,
        spacing=spacing,
        align="center" if anchor.startswith("m") else "left",
    )


def panel(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: str,
    radius: int = 24,
    outline: str | None = None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def brand_mark(draw: ImageDraw.ImageDraw, x: int, y: int, inverse: bool = False) -> None:
    color = WHITE if inverse else FOREST
    text(draw, (x, y), "d_clutr", 31, color, "serif")
    draw.ellipse((x + 141, y + 18, x + 150, y + 27), fill=SAND)


def pill(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    label: str,
    fill: str,
    color: str,
    size: int = 18,
) -> None:
    panel(draw, box, fill, (box[3] - box[1]) // 2)
    text(draw, ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2), label, size, color, "sans", "mm")


def draw_phone_stand(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    panel(draw, (cx - 48, cy - 80, cx + 48, cy + 56), "#30413B", 17)
    panel(draw, (cx - 37, cy - 67, cx + 37, cy + 43), "#DCE7D9", 8)
    draw.line((cx - 35, cy + 82, cx + 35, cy + 82), fill=FOREST, width=9)
    draw.polygon(((cx - 34, cy + 77), (cx, cy + 8), (cx + 34, cy + 77)), fill=SAND)
    draw.line((cx, cy + 48, cx, cy + 80), fill=FOREST, width=7)
    draw.arc((cx + 58, cy - 2, cx + 112, cy + 52), 175, 355, fill=CLAY, width=8)
    draw.arc((cx + 67, cy + 8, cx + 103, cy + 43), 178, 356, fill=CLAY, width=7)


def draw_fridge(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    panel(draw, (cx - 70, cy - 100, cx + 70, cy + 105), "#E5ECE1", 19, "#9AAF98", 3)
    draw.line((cx - 67, cy - 8, cx + 67, cy - 8), fill="#AABBA8", width=3)
    draw.rounded_rectangle((cx + 43, cy - 68, cx + 49, cy - 28), radius=3, fill=FOREST)
    draw.rounded_rectangle((cx + 43, cy + 18, cx + 49, cy + 58), radius=3, fill=FOREST)
    draw.ellipse((cx - 8, cy + 75, cx + 8, cy + 91), fill=SAND)


def draw_books(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    colors = ("#788E73", "#D1A36D", "#B9745E", "#859BA0")
    for i, color in enumerate(colors):
        x = cx - 105 + i * 18
        y = cy - 30 + (i % 2) * 18
        panel(draw, (x, y, x + 150, y + 42), color, 5)
        draw.line((x + 15, y + 7, x + 15, y + 35), fill=WHITE, width=3)
        draw.line((x + 25, y + 11, x + 78, y + 11), fill="#F6F1E7", width=2)


def draw_shoes_bag(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.rounded_rectangle((cx - 95, cy + 3, cx + 22, cy + 53), radius=20, fill="#C77C61")
    draw.polygon(((cx - 92, cy + 9), (cx - 48, cy - 35), (cx - 3, cy - 4), (cx + 18, cy + 13)), fill="#D9997C")
    draw.line((cx - 42, cy - 13, cx - 2, cy + 11), fill=WHITE, width=5)
    draw.line((cx - 48, cy - 4, cx - 12, cy + 17), fill=WHITE, width=4)
    panel(draw, (cx + 35, cy - 51, cx + 120, cy + 61), "#789078", 17)
    draw.arc((cx + 53, cy - 78, cx + 103, cy - 21), 180, 360, fill=FOREST, width=8)
    panel(draw, (cx + 48, cy - 31, cx + 107, cy + 25), "#A7BBA3", 9)


def draw_stuff(draw: ImageDraw.ImageDraw, t: float) -> None:
    for index, (x, y, size, color) in enumerate(
        ((85, 680, 58, SAGE), (624, 641, 45, "#E4D7B8"), (125, 895, 34, "#D7E1D2"), (604, 958, 54, "#E6D9CF"))
    ):
        bob = math.sin(t * 3 + index * 1.6) * 7
        draw.ellipse((x - size, y - size + bob, x + size, y + size + bob), fill=color)
    draw.rounded_rectangle((230, 746, 490, 990), radius=28, fill="#E0E5D8")
    draw.line((255, 787, 465, 787), fill="#B3C4B0", width=5)
    draw.rounded_rectangle((268, 865, 452, 935), radius=20, fill=SAND)
    draw.rectangle((285, 925, 300, 969), fill=FOREST)
    draw.rectangle((419, 925, 434, 969), fill=FOREST)
    draw.ellipse((320, 750, 400, 817), fill="#FFFFFF")
    text(draw, (360, 784), "₦", 46, FOREST, "serif", "mm")


def scene_hook(t: float) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    brand_mark(draw, 52, 48)
    text(draw, (54, 158), "MADE FOR FUTA, AKURE", 17, MUTED, "sans_bold")
    slide = int(smooth((t - 0.15) / 0.6) * 28)
    text(draw, (54, 240 + 28 - slide), "Got stuff you\nno longer use?", 67, INK, "serif_regular", spacing=0)
    draw_stuff(draw, t)
    if t > 1.05:
        progress = smooth((t - 1.05) / 0.35)
        y = int(1035 + 32 * (1 - progress))
        pill(draw, (54, y, 350, y + 72), "Turn it into cash.", FOREST, WHITE, 22)
        draw.line((385, y + 37, 581, y + 37), fill=SAGE_MID, width=3)
        draw.polygon(((581, y + 37), (564, y + 27), (564, y + 47)), fill=SAGE_MID)
    text(draw, (665, 1214), "01 / 04", 15, MUTED, "sans_bold", "ra")
    return image


def draw_product_illustration(draw: ImageDraw.ImageDraw, kind: int, cx: int, cy: int) -> None:
    if kind == 0:
        draw_phone_stand(draw, cx, cy)
    elif kind == 1:
        draw_fridge(draw, cx, cy)
    elif kind == 2:
        draw_books(draw, cx, cy)
    else:
        draw_shoes_bag(draw, cx, cy)


def scene_items(t: float) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#F1EFE6")
    draw = ImageDraw.Draw(image)
    brand_mark(draw, 52, 48)
    text(draw, (55, 150), "CAMPUS LIFE MOVES FAST", 17, MUTED, "sans_bold")
    text(draw, (55, 188), "Give good things\na second chapter.", 49, INK, "serif_regular", spacing=0)

    item_index = min(3, int(t / 1.1))
    item_progress = (t % 1.1) / 1.1 if item_index < 3 else min(1, (t - 3.3) / 1.7)
    card_y = 455 + int(22 * (1 - smooth(min(1, item_progress / 0.4))))
    panel(draw, (54, card_y, 666, card_y + 358), WHITE, 30, "#E6E7DC", 2)
    draw.ellipse((270, card_y + 28, 450, card_y + 208), fill=("#E7ECE2", "#EFE7D9", "#E6E9E0", "#F1E4DF")[item_index])
    draw_product_illustration(draw, item_index, 360, card_y + 120)
    headings = (
        ("Phone stand + earphones", "A quick hostel clear-out"),
        ("Mini fridge", "Moving hostels? Pass it on."),
        ("Textbooks", "Done with the semester?"),
        ("Sneakers + a bag", "Make room for the next pair."),
    )
    text(draw, (360, card_y + 245), headings[item_index][0], 24, INK, "serif", "mm")
    text(draw, (360, card_y + 286), headings[item_index][1], 16, MUTED, "sans", "mm")
    for index in range(4):
        fill = FOREST if index == item_index else "#D7DCCF"
        draw.ellipse((330 + index * 20, card_y + 324, 340 + index * 20, card_y + 334), fill=fill)

    text(draw, (55, 878), "If you don't need it,", 25, INK, "sans_bold")
    text(draw, (55, 914), "someone on campus does.", 25, FOREST, "serif")
    panel(draw, (54, 986, 666, 1138), "#E5EADF", 22)
    text(draw, (360, 1026), "Mattress  ·  Generator  ·  Fan", 18, FOREST, "sans_bold", "mm")
    text(draw, (360, 1082), "Clothes  ·  Study lamp  ·  Bed frame", 18, FOREST, "sans_bold", "mm")
    text(draw, (665, 1214), "02 / 04", 15, MUTED, "sans_bold", "ra")
    return image


def draw_listing_screen(draw: ImageDraw.ImageDraw, t: float) -> None:
    x, y, w, h = 183, 380, 354, 574
    panel(draw, (x - 11, y - 11, x + w + 11, y + h + 11), "#122B21", 42)
    panel(draw, (x, y, x + w, y + h), WHITE, 33)
    panel(draw, (x + 133, y + 12, x + 222, y + 31), "#17251D", 10)
    brand_mark(draw, x + 22, y + 49)
    draw.line((x + 22, y + 99, x + w - 22, y + 99), fill=LINE, width=2)
    text(draw, (x + 22, y + 124), "Post something for sale.", 21, INK, "serif")
    text(draw, (x + 22, y + 158), "Tell buyers about your item", 13, MUTED, "sans")
    fields = (
        ("WHAT ARE YOU SELLING?", "e.g. Study lamp"),
        ("CATEGORY", "Campus essentials"),
        ("YOUR PRICE (₦)", "Your price"),
    )
    y_cursor = y + 198
    for label, placeholder in fields:
        text(draw, (x + 22, y_cursor), label, 10, MUTED, "sans_bold")
        panel(draw, (x + 22, y_cursor + 16, x + w - 22, y_cursor + 60), PAPER, 9, LINE, 1)
        text(draw, (x + 35, y_cursor + 38), placeholder, 13, "#7C887D", "sans", "lm")
        y_cursor += 83
    panel(draw, (x + 22, y_cursor + 2, x + w - 22, y_cursor + 56), "#F2F4EE", 10, "#DEE4DA", 1)
    text(draw, (x + w // 2, y_cursor + 29), "+  Add photos of your item", 13, MUTED, "sans", "mm")
    panel(draw, (x + 22, y + h - 74, x + w - 22, y + h - 22), FOREST, 12)
    text(draw, (x + w // 2, y + h - 48), "Post your item", 15, WHITE, "sans_bold", "mm")
    sheen = int(14 * math.sin(t * 4))
    draw.rounded_rectangle((x + 25 + sheen, y + h - 70, x + 48 + sheen, y + h - 68), radius=1, fill="#FFFFFF44")


def scene_solution(t: float) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), FOREST)
    draw = ImageDraw.Draw(image)
    brand_mark(draw, 52, 48, inverse=True)
    text(draw, (55, 148), "A BETTER WAY TO PASS IT ON", 16, "#C6D6C0", "sans_bold")
    text(draw, (360, 222), "List it on d_clutr\nin 2 minutes.", 48, WHITE, "serif_regular", "ma", spacing=1)
    lift = int(24 * (1 - smooth(t / 0.6)))
    draw_listing_screen(draw, t)
    text(draw, (360, 1018 + lift), "Buy what you need for less,", 22, "#DCE7D9", "sans_bold", "mm")
    text(draw, (360, 1054 + lift), "from students near you.", 23, WHITE, "serif", "mm")
    text(draw, (665, 1214), "03 / 04", 15, "#C6D6C0", "sans_bold", "ra")
    return image


def draw_floating_shapes(draw: ImageDraw.ImageDraw, t: float) -> None:
    shapes = (
        (110, 340, 70, "#E8EDE3"),
        (600, 300, 82, "#EFE7D9"),
        (100, 865, 48, "#E7DDD3"),
        (620, 896, 64, "#DCE7D9"),
    )
    for i, (x, y, r, color) in enumerate(shapes):
        bob = int(math.sin(t * 2.3 + i) * 8)
        draw.ellipse((x - r, y - r + bob, x + r, y + r + bob), fill=color)


def scene_cta(t: float) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw_floating_shapes(draw, t)
    brand_mark(draw, 52, 48)
    draw.ellipse((542, 336, 557, 351), fill=SAND)
    text(draw, (360, 518), "Buy and Sell Used Items", 31, INK, "serif", "mm")
    text(draw, (360, 563), "at FUTA", 33, FOREST, "serif", "mm")
    draw.line((250, 625, 470, 625), fill="#C9D6C4", width=2)
    button_y = 716 + int(20 * (1 - smooth(t / 0.55)))
    panel(draw, (111, button_y, 609, button_y + 87), FOREST, 18)
    text(draw, (360, button_y + 43), "Start Selling Today", 24, WHITE, "sans_bold", "mm")
    draw.ellipse((549, button_y + 30, 579, button_y + 60), outline="#DCE7D9", width=2)
    draw.line((557, button_y + 45, 571, button_y + 45), fill=WHITE, width=2)
    draw.line((566, button_y + 40, 571, button_y + 45), fill=WHITE, width=2)
    draw.line((566, button_y + 50, 571, button_y + 45), fill=WHITE, width=2)
    text(draw, (360, 1050), "Pass a good thing on.", 21, MUTED, "serif", "mm")
    text(draw, (360, 1214), "MADE FOR FUTA  ·  AKURE", 15, MUTED, "sans_bold", "mm")
    return image


SCENES = (
    (0.0, 3.0, scene_hook),
    (3.0, 8.0, scene_items),
    (8.0, 13.0, scene_solution),
    (13.0, 15.0, scene_cta),
)
TRANSITION = 0.24


def render_frame(time_s: float) -> Image.Image:
    current_index = next(
        (i for i, (start, end, _) in enumerate(SCENES) if start <= time_s < end),
        len(SCENES) - 1,
    )
    start, _, renderer = SCENES[current_index]
    current = renderer(time_s - start)
    if current_index and time_s < start + TRANSITION:
        previous_start, _, previous_renderer = SCENES[current_index - 1]
        previous = previous_renderer(max(0.0, time_s - TRANSITION - previous_start))
        return Image.blend(previous, current, smooth((time_s - start) / TRANSITION))
    return current


def render_audio(path: Path, workdir: Path) -> None:
    sample_rate = 44100
    sample_count = sample_rate * DURATION
    times = np.arange(sample_count, dtype=np.float64) / sample_rate
    music = np.zeros(sample_count, dtype=np.float64)
    beat = 60 / 104
    random = np.random.default_rng(42)
    noise = random.normal(0, 1, sample_count)

    chords = (
        (130.81, 164.81, 196.00),
        (110.00, 130.81, 164.81),
        (87.31, 110.00, 130.81),
        (98.00, 123.47, 146.83),
    )
    chord_length = int(beat * 4 * sample_rate)
    for index, notes in enumerate((chords * 2)[: math.ceil(DURATION / (beat * 4))]):
        start = int(index * beat * 4 * sample_rate)
        end = min(start + chord_length, sample_count)
        local = np.arange(end - start, dtype=np.float64) / sample_rate
        swell = 0.8 + 0.2 * np.sin(2 * math.pi * local / (beat * 4))
        pad = np.zeros(end - start, dtype=np.float64)
        for note in notes:
            pad += np.sin(2 * math.pi * note * local)
            pad += 0.25 * np.sin(2 * math.pi * note * 2.003 * local + 0.2)
        music[start:end] += 0.011 * swell * pad

    melody = (392.00, 329.63, 392.00, 493.88, 440.00, 392.00, 329.63, 293.66)
    for index, frequency in enumerate(melody * 2):
        onset = 0.15 + index * beat
        local = times - onset
        active = local >= 0
        elapsed = np.maximum(local, 0)
        envelope = np.exp(-3.4 * elapsed) * active
        pluck = np.sin(2 * math.pi * frequency * elapsed)
        pluck += 0.32 * np.sin(2 * math.pi * frequency * 2.01 * elapsed + 0.2)
        pluck += 0.12 * np.sin(2 * math.pi * frequency * 3.98 * elapsed)
        music += 0.033 * envelope * pluck

    roots = (65.41, 55.00, 43.65, 49.00)
    for index in range(math.ceil(DURATION / beat)):
        onset = index * beat
        local = times - onset
        active = local >= 0
        elapsed = np.maximum(local, 0)
        envelope = np.exp(-5.5 * elapsed) * active
        bass = np.sin(2 * math.pi * roots[(index // 4) % len(roots)] * elapsed)
        music += 0.072 * envelope * bass

        if index % 4 in (0, 2):
            kick_envelope = np.exp(-25 * elapsed) * active
            kick_phase = 2 * math.pi * (68 * elapsed - 18 * elapsed**2)
            kick = np.sin(kick_phase) * kick_envelope
            music += 0.13 * kick
        else:
            snap = np.exp(-34 * elapsed) * active
            end = min(sample_count, int((onset + 0.12) * sample_rate))
            start = int(onset * sample_rate)
            if end > start:
                noise_snap = noise[start:end]
                snap_slice = snap[start:end]
                music[start:end] += 0.019 * noise_snap * snap_slice

    for index in range(math.ceil(DURATION / (beat / 2))):
        if index % 2 == 0:
            continue
        onset = index * beat / 2
        start = int(onset * sample_rate)
        end = min(sample_count, start + int(0.055 * sample_rate))
        if end > start:
            elapsed = np.arange(end - start, dtype=np.float64) / sample_rate
            shaker = noise[start:end] - np.concatenate(([0.0], noise[start : end - 1]))
            music[start:end] += 0.004 * shaker * np.exp(-58 * elapsed)

    music *= np.minimum(1, times / 0.24) * np.minimum(1, (DURATION - times) / 0.55)

    voice_script = ROOT / "tools" / "create_dclutr_voiceover.ps1"
    powershell = shutil.which("powershell.exe")
    if powershell is None:
        raise RuntimeError("Windows PowerShell is required to synthesize the local voiceover.")
    subprocess.run(
        [
            powershell,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(voice_script),
            "-OutputDirectory",
            str(workdir),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    voice_track = np.zeros(sample_count, dtype=np.float64)
    voice_windows = ((0.18, 2.92), (3.18, 7.92), (8.18, 12.92), (12.50, 15.0))
    for index, (start_s, end_s) in enumerate(voice_windows, start=1):
        voice_path = workdir / f"voice-{index}.wav"
        with wave.open(str(voice_path), "rb") as source:
            if source.getnchannels() != 1 or source.getsampwidth() != 2:
                raise RuntimeError(f"Unexpected audio format in {voice_path.name}")
            voice_sample_rate = source.getframerate()
            voice = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float64) / 32768
        if voice_sample_rate != sample_rate:
            source_times = np.arange(len(voice), dtype=np.float64) / voice_sample_rate
            target_times = np.arange(
                round(len(voice) * sample_rate / voice_sample_rate), dtype=np.float64
            ) / sample_rate
            voice = np.interp(target_times, source_times, voice)

        start = int(start_s * sample_rate)
        limit = min(int(end_s * sample_rate), sample_count) - start
        if len(voice) > limit:
            raise RuntimeError(
                f"Voiceover line {index} is longer than its scene ({len(voice) / sample_rate:.2f}s)."
            )
        voice /= max(float(np.max(np.abs(voice))), 1e-6)
        voice_track[start : start + len(voice)] += voice * 0.73

    fade_samples = int(0.09 * sample_rate)
    fade_in = np.linspace(0, 1, fade_samples, endpoint=False)
    fade_out = np.linspace(1, 0, fade_samples, endpoint=False)
    for start_s, end_s in voice_windows:
        start = int(start_s * sample_rate)
        end = min(int(end_s * sample_rate), sample_count)
        voice_track[start : min(start + fade_samples, end)] *= fade_in[: min(fade_samples, end - start)]
        voice_track[max(start, end - fade_samples) : end] *= fade_out[-min(fade_samples, end - start) :]

    music_gain = np.full(sample_count, 0.34, dtype=np.float64)
    duck_samples = int(0.12 * sample_rate)
    for start_s, end_s in voice_windows:
        start = max(0, int(start_s * sample_rate) - duck_samples)
        end = min(sample_count, int(end_s * sample_rate) + duck_samples)
        music_gain[start:end] = 0.22
        ramp = min(duck_samples, end - start)
        music_gain[start : start + ramp] = np.linspace(0.34, 0.22, ramp)
        music_gain[end - ramp : end] = np.linspace(0.22, 0.34, ramp)
    music *= music_gain
    mixed = voice_track + music
    peak = float(np.max(np.abs(mixed)))
    if peak > 0.92:
        mixed *= 0.92 / peak
    samples = (mixed * 32767).astype("<i2")
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(samples.tobytes())


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg_exe = shutil.which("ffmpeg")
    if ffmpeg_exe is None:
        package_root = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
        for package in package_root.glob("Gyan.FFmpeg.Shared_*"):
            for build in package.glob("ffmpeg-*"):
                candidate = build / "bin" / "ffmpeg.exe"
                if candidate.is_file():
                    ffmpeg_exe = str(candidate)
                    break
            if ffmpeg_exe:
                break
    if ffmpeg_exe is None:
        raise RuntimeError("FFmpeg is required to render the MP4. Install FFmpeg and add it to PATH.")

    with tempfile.TemporaryDirectory(prefix="dclutr-ad-") as workdir:
        audio_path = Path(workdir) / "original-music.wav"
        render_audio(audio_path, Path(workdir))
        command = [
            ffmpeg_exe,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-vcodec",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{WIDTH}x{HEIGHT}",
            "-r",
            str(FPS),
            "-i",
            "pipe:0",
            "-i",
            str(audio_path),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-t",
            str(DURATION),
            "-movflags",
            "+faststart",
            str(OUTPUT),
        ]
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        assert process.stdin is not None
        try:
            for frame_index in range(FPS * DURATION):
                frame = render_frame(frame_index / FPS)
                process.stdin.write(frame.tobytes())
                if frame_index % FPS == 0:
                    print(f"Rendering {frame_index // FPS + 1:02d}/{DURATION}s", flush=True)
            process.stdin.close()
        except Exception:
            process.stdin.close()
            process.terminate()
            process.wait()
            raise
        error = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
        if process.wait():
            raise RuntimeError(f"FFmpeg failed: {error}")
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
