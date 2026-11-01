
import json
import hashlib
import subprocess
import traceback
import os
import time
import shutil
import re

from pathlib import Path
from datetime import datetime, timezone
from html.parser import HTMLParser

from playwright.sync_api import sync_playwright


# ============================================================
# PATHS & CONFIGURATION
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

HTML = ROOT / "HTML"
VIDEO = ROOT / "VIDEO"
DB = ROOT / "DATABASE"
TEMP = ROOT / "TEMP"
LOG = ROOT / "LOGS" / "render.log"

MAN = DB / "render_manifest.json"
HIST = DB / "render_history.json"

CFG = json.loads(
    (ROOT / "CONFIG" / "settings.json").read_text(encoding="utf-8")
)

DURATION_CFG = CFG.get("duration", {})
VIDEO_CFG = CFG.get("video", {})
AUDIO_CFG = CFG.get("audio", {})
BROWSER_CFG = CFG.get("browser", {})


# ============================================================
# GENERAL UTILITIES
# ============================================================

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log(message):
    LOG.parent.mkdir(parents=True, exist_ok=True)

    line = f"[{now()}] {message}"

    print(line, flush=True)

    with LOG.open("a", encoding="utf-8") as file:
        file.write(line + "\n")


def read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    temporary = path.with_suffix(path.suffix + ".tmp")

    temporary.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

    os.replace(temporary, path)


def sha(path):
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)

    return digest.hexdigest()


def number(value):
    try:
        result = float(value)

        if result > 0 and result < float("inf"):
            return result

    except (TypeError, ValueError):
        pass

    return None


# ============================================================
# HTML STATIC METADATA DETECTION
# ============================================================

class HTMLMetadataParser(HTMLParser):

    def __init__(self):
        super().__init__()

        self.metadata = {}
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag == "meta":
            name = attrs.get("name", "").lower()

            if name.startswith("render-"):
                self.metadata[name[7:]] = attrs.get("content", "")

        if tag == "html":
            for key in (
                "duration",
                "orientation",
                "width",
                "height"
            ):
                attribute = "data-render-" + key

                if attribute in attrs:
                    self.metadata[key] = attrs[attribute]

        if tag == "title":
            self.in_title = True

    def handle_data(self, data):
        if self.in_title:
            self.title += data

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False


def meta(path):
    """
    Membaca metadata HTML.

    Penting:
    - Tidak lagi memotong durasi ke max_seconds.
    - Tidak langsung menganggap durasi 30 detik.
    - Durasi yang tidak ditemukan akan bernilai None.
    """

    content = path.read_text(
        encoding="utf-8",
        errors="replace"
    )

    parser = HTMLMetadataParser()
    parser.feed(content)

    metadata = parser.metadata

    explicit_duration = number(metadata.get("duration"))

    orientation = metadata.get(
        "orientation",
        "auto"
    ).lower()

    width = number(metadata.get("width"))
    height = number(metadata.get("height"))

    if width and height:
        width = int(width)
        height = int(height)

    else:
        if orientation == "auto":
            orientation = VIDEO_CFG.get(
                "default_orientation",
                "landscape"
            )

        if orientation == "portrait":
            size = VIDEO_CFG["portrait"]
        else:
            orientation = "landscape"
            size = VIDEO_CFG["landscape"]

        width = int(size["width"])
        height = int(size["height"])

    min_seconds = float(
        DURATION_CFG.get("min_seconds", 1)
    )

    if explicit_duration is not None:
        explicit_duration = max(
            min_seconds,
            explicit_duration
        )

    return (
        explicit_duration,
        width,
        height,
        orientation,
        parser.title.strip()
    )


# ============================================================
# BROWSER RUNTIME DURATION DETECTION
# ============================================================

DURATION_PROBE_JS = r"""
() => {

    const result = {
        animationSeconds: 0,
        mediaSeconds: 0,
        infiniteAnimations: 0,
        animationCount: 0,
        mediaCount: 0
    };

    // --------------------------------------------------------
    // CSS ANIMATIONS + WEB ANIMATIONS API
    // --------------------------------------------------------

    for (const animation of document.getAnimations({subtree: true})) {

        try {

            const timing = animation.effect?.getComputedTiming();

            if (!timing) continue;

            result.animationCount++;

            const endTime = Number(timing.endTime);

            if (
                Number.isFinite(endTime) &&
                endTime > 0
            ) {

                result.animationSeconds = Math.max(
                    result.animationSeconds,
                    endTime / 1000
                );

            } else if (
                timing.iterations === Infinity ||
                !Number.isFinite(endTime)
            ) {

                result.infiniteAnimations++;
            }

        } catch (_) {}
    }

    // --------------------------------------------------------
    // AUDIO + VIDEO
    // --------------------------------------------------------

    const mediaElements = document.querySelectorAll(
        "audio, video"
    );

    for (const media of mediaElements) {

        result.mediaCount++;

        const duration = Number(media.duration);

        if (
            Number.isFinite(duration) &&
            duration > 0
        ) {

            result.mediaSeconds = Math.max(
                result.mediaSeconds,
                duration
            );
        }
    }

    return result;
}
"""


def detect_runtime_duration(page):
    """
    Membaca durasi animasi dan media dari browser Chromium.
    """

    try:

        result = page.evaluate(DURATION_PROBE_JS)

        animation_seconds = number(
            result.get("animationSeconds")
        ) or 0

        media_seconds = number(
            result.get("mediaSeconds")
        ) or 0

        detected = max(
            animation_seconds,
            media_seconds
        )

        log(
            "[DURATION] Browser scan: "
            f"animations={animation_seconds:.2f}s, "
            f"media={media_seconds:.2f}s, "
            f"count={result.get('animationCount', 0)}, "
            f"infinite={result.get('infiniteAnimations', 0)}"
        )

        return detected, result

    except Exception as error:

        log(
            "[DURATION] Browser detection warning: "
            + str(error)
        )

        return 0, {}


def choose_duration(explicit_duration, runtime_duration):
    """
    Memilih durasi terpanjang yang berhasil dideteksi.

    Tidak ada pemotongan max_seconds.
    """

    candidates = []

    if explicit_duration:
        candidates.append(explicit_duration)

    if runtime_duration:
        candidates.append(runtime_duration)

    if candidates:
        duration = max(candidates)

        source = (
            "HTML metadata + browser detection"
            if len(candidates) > 1
            else (
                "HTML metadata"
                if explicit_duration
                else "browser animation/media detection"
            )
        )

    else:
        duration = float(
            DURATION_CFG.get("default_seconds", 30)
        )

        source = "CONFIG fallback"

        log(
            "[WARNING] Durasi tidak ditemukan dari HTML. "
            f"Menggunakan fallback {duration}s."
        )

    minimum = float(
        DURATION_CFG.get("min_seconds", 1)
    )

    duration = max(minimum, duration)

    # Max seconds hanya menjadi peringatan.
    # Tidak digunakan untuk memotong video.
    maximum = DURATION_CFG.get("max_seconds")

    if maximum is not None:

        try:

            maximum = float(maximum)

            if duration > maximum:

                log(
                    "[WARNING] Durasi "
                    f"{duration:.2f}s melebihi konfigurasi "
                    f"max_seconds={maximum}s. "
                    "Durasi TIDAK dipotong."
                )

        except (TypeError, ValueError):
            pass

    return duration, source


# ============================================================
# AUDIO CAPTURE
# ============================================================

def audio_start(wav):

    if not AUDIO_CFG.get("enabled", True):
        return None

    subprocess.run(
        [
            "pulseaudio",
            "--start",
            "--exit-idle-time=-1",
            "--daemonize=yes"
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    time.sleep(1)

    result = subprocess.run(
        [
            "pactl",
            "load-module",
            "module-null-sink",
            "sink_name=html_render"
        ],
        capture_output=True,
        text=True,
        check=True
    )

    module = result.stdout.strip()

    subprocess.run(
        [
            "pactl",
            "set-default-sink",
            "html_render"
        ],
        check=True
    )

    process = subprocess.Popen(
        [
            "ffmpeg",
            "-y",
            "-f",
            "pulse",
            "-i",
            "html_render.monitor",
            "-ac",
            str(AUDIO_CFG.get("channels", 2)),
            "-ar",
            str(AUDIO_CFG.get("sample_rate", 48000)),
            "-c:a",
            "pcm_s16le",
            str(wav)
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    time.sleep(0.5)

    return process, module


def audio_stop(state):

    if not state:
        return

    process, module = state

    if process.poll() is None:

        process.terminate()

        try:
            process.wait(timeout=10)

        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()

    subprocess.run(
        ["pactl", "unload-module", str(module)],
        capture_output=True
    )


# ============================================================
# HTML RECORDING
# ============================================================

def record(src, folder, width, height, explicit_duration):

    errors = []

    folder.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:

        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--autoplay-policy=no-user-gesture-required",
                "--disable-dev-shm-usage"
            ]
        )

        context = browser.new_context(
            viewport={
                "width": width,
                "height": height
            },
            device_scale_factor=1,
            record_video_dir=str(folder),
            record_video_size={
                "width": width,
                "height": height
            },
            reduced_motion="no-preference"
        )

        page = context.new_page()

        page.add_init_script(
            """
            window.__renderDone = false;

            window.addEventListener(
                'html-render-done',
                () => window.__renderDone = true
            );

            window.addEventListener(
                'render:done',
                () => window.__renderDone = true
            );
            """
        )

        page.on(
            "pageerror",
            lambda error: errors.append(str(error))
        )

        video_path = None
        selected_duration = None
        duration_source = None

        try:

            log("[BROWSER] Opening " + src.name)

            page.goto(
                src.resolve().as_uri(),
                wait_until="load",
                timeout=BROWSER_CFG.get(
                    "navigation_timeout_ms",
                    60000
                )
            )

            # Tunggu font siap.
            try:

                page.evaluate(
                    "() => document.fonts.ready"
                )

            except Exception:
                pass

            # Tunggu waktu persiapan sesuai konfigurasi.
            preparation_wait = int(
                BROWSER_CFG.get(
                    "wait_before_recording_ms",
                    1000
                )
            )

            if preparation_wait > 0:
                page.wait_for_timeout(preparation_wait)

            # Tunggu media agar metadata durasinya tersedia.
            try:

                page.wait_for_function(
                    """
                    () => {
                        const media = [
                            ...document.querySelectorAll('audio,video')
                        ];

                        return media.every(
                            item =>
                                item.readyState >= 1 ||
                                item.error !== null
                        );
                    }
                    """,
                    timeout=5000,
                    polling=100
                )

            except Exception:
                pass

            # Deteksi durasi dari browser.
            runtime_duration, runtime_info = (
                detect_runtime_duration(page)
            )

            selected_duration, duration_source = choose_duration(
                explicit_duration,
                runtime_duration
            )

            log(
                "[DURATION] Selected: "
                f"{selected_duration:.2f}s "
                f"({duration_source})"
            )

            # Tambahan waktu opsional untuk frame terakhir.
            tail_seconds = float(
                DURATION_CFG.get("tail_seconds", 0)
            )

            if tail_seconds > 0:
                selected_duration += tail_seconds

                log(
                    f"[DURATION] Tail padding: "
                    f"{tail_seconds:.2f}s"
                )

            # Tunggu sinyal selesai atau durasi penuh.
            allow_early_done = DURATION_CFG.get(
                "allow_early_done_signal",
                True
            )

            if allow_early_done:

                try:

                    page.wait_for_function(
                        """
                        () =>
                            window.__renderDone === true ||
                            window.HTML_MP4_RENDER_DONE === true
                        """,
                        timeout=int(selected_duration * 1000),
                        polling=100
                    )

                    log(
                        "[RENDER] HTML completion signal received."
                    )

                except Exception:

                    log(
                        "[RENDER] Completion signal not received. "
                        f"Using full duration {selected_duration:.2f}s."
                    )

            else:

                page.wait_for_timeout(
                    int(selected_duration * 1000)
                )

        finally:

            video = page.video

            context.close()
            browser.close()

            video_path = (
                Path(video.path())
                if video
                else None
            )

        if errors:

            log(
                "[JAVASCRIPT] Errors: "
                + " | ".join(errors[:5])
            )

    if (
        not video_path
        or not video_path.exists()
        or not video_path.stat().st_size
    ):

        raise RuntimeError(
            "Rekaman Chromium kosong atau gagal dibuat."
        )

    return (
        video_path,
        selected_duration,
        duration_source
    )


# ============================================================
# VIDEO ENCODING
# ============================================================

def encode(webm, wav, output):

    output.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    use_audio = (
        AUDIO_CFG.get("enabled", True)
        and wav.exists()
        and wav.stat().st_size > 44
    )

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(webm)
    ]

    if use_audio:
        command += [
            "-i",
            str(wav)
        ]

    command += [
        "-map",
        "0:v:0",
        "-vf",
        (
            f"fps={VIDEO_CFG.get('fps', 30)},"
            "format=yuv420p"
        ),
        "-c:v",
        VIDEO_CFG.get("codec", "libx264"),
        "-preset",
        VIDEO_CFG.get("preset", "veryfast"),
        "-crf",
        str(VIDEO_CFG.get("crf", 20)),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart"
    ]

    if use_audio:

        command += [
            "-map",
            "1:a:0",
            "-c:a",
            "aac",
            "-b:a",
            AUDIO_CFG.get("bitrate", "192k"),
            "-af",
            "aresample=async=1:first_pts=0,apad",
            "-shortest"
        ]

    else:

        command += [
            "-an"
        ]

    command.append(str(output))

    result = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if result.returncode:

        raise RuntimeError(
            "FFmpeg encoding error:\n"
            + result.stderr[-4000:]
        )

    # Validasi hasil MP4.
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(output)
        ],
        capture_output=True,
        text=True
    )

    if probe.returncode or not probe.stdout.strip():

        raise RuntimeError(
            "MP4 gagal divalidasi oleh ffprobe."
        )

    seconds = float(probe.stdout.strip())

    if seconds <= 0:

        raise RuntimeError(
            "Durasi MP4 tidak valid."
        )

    return seconds, use_audio


# ============================================================
# MAIN RENDER ENGINE
# ============================================================

def main():

    for tool in ("ffmpeg", "ffprobe"):

        if not shutil.which(tool):

            raise RuntimeError(
                tool + " tidak ditemukan."
            )

    if AUDIO_CFG.get("enabled", True):

        for tool in ("pulseaudio", "pactl"):

            if not shutil.which(tool):

                raise RuntimeError(
                    tool + " dibutuhkan untuk audio."
                )

    HTML.mkdir(exist_ok=True)
    VIDEO.mkdir(exist_ok=True)
    TEMP.mkdir(exist_ok=True)
    DB.mkdir(exist_ok=True)

    manifest = read(
        MAN,
        {
            "schema_version": 3,
            "files": {}
        }
    )

    history = read(HIST, [])

    manifest.setdefault("files", {})

    sources = sorted(
        file
        for file in HTML.rglob("*")
        if file.is_file()
        and file.suffix.lower() in (".html", ".htm")
    )

    if not sources:

        log("Tidak ada file HTML.")
        return 0

    success = 0
    skipped = 0
    failed = 0

    for src in sources:

        relative = src.relative_to(HTML).as_posix()

        digest = sha(src)

        output = (
            VIDEO / Path(relative)
        ).with_suffix(".mp4")

        old = manifest["files"].get(relative, {})

        # ----------------------------------------------------
        # SHA-256 DUPLICATE PROTECTION
        # ----------------------------------------------------

        if (
            old.get("status") == "success"
            and old.get("sha256") == digest
            and output.exists()
            and output.stat().st_size > 0
        ):

            skipped += 1

            log("SKIP " + relative)

            continue

        # ----------------------------------------------------
        # START RECORD
        # ----------------------------------------------------

        record_data = {
            "html_filename": relative,
            "sha256": digest,
            "output_filename": output.relative_to(VIDEO).as_posix(),
            "status": "processing",
            "started_at": now()
        }

        manifest["files"][relative] = record_data

        save(MAN, manifest)

        work = TEMP / (
            src.stem + "-" + digest[:8]
        )

        work.mkdir(
            parents=True,
            exist_ok=True
        )

        wav = work / "audio.wav"

        audio_state = None

        try:

            # ------------------------------------------------
            # HTML VALIDATION
            # ------------------------------------------------

            content = src.read_text(
                encoding="utf-8",
                errors="replace"
            )

            if not content.strip():

                raise RuntimeError(
                    "Dokumen HTML kosong."
                )

            if (
                "<html" not in content.lower()
                and "<!doctype html" not in content.lower()
            ):

                raise RuntimeError(
                    "Dokumen HTML tidak valid."
                )

            # ------------------------------------------------
            # READ HTML METADATA
            # ------------------------------------------------

            (
                explicit_duration,
                width,
                height,
                orientation,
                title
            ) = meta(src)

            if explicit_duration:

                log(
                    f"[HTML] Explicit duration: "
                    f"{explicit_duration:.2f}s"
                )

            else:

                log(
                    "[HTML] Explicit duration not found. "
                    "Will inspect browser animations and media."
                )

            # ------------------------------------------------
            # START AUDIO
            # ------------------------------------------------

            audio_state = audio_start(wav)

            # ------------------------------------------------
            # RECORD HTML
            # ------------------------------------------------

            (
                webm,
                selected_duration,
                duration_source
            ) = record(
                src,
                work,
                width,
                height,
                explicit_duration
            )

            # Stop audio after browser recording ends.
            audio_stop(audio_state)
            audio_state = None

            # ------------------------------------------------
            # ENCODE MP4
            # ------------------------------------------------

            actual_seconds, audio_included = encode(
                webm,
                wav,
                output
            )

            # ------------------------------------------------
            # DURATION VALIDATION
            # ------------------------------------------------

            tolerance = float(
                DURATION_CFG.get(
                    "validation_tolerance_seconds",
                    2.0
                )
            )

            if (
                actual_seconds + tolerance
                < selected_duration
            ):

                raise RuntimeError(
                    "Durasi MP4 lebih pendek daripada target render. "
                    f"Target={selected_duration:.2f}s, "
                    f"hasil={actual_seconds:.2f}s."
                )

            record_data.update(
                status="success",
                finished_at=now(),
                duration_seconds=round(actual_seconds, 3),
                detected_duration_seconds=round(
                    selected_duration,
                    3
                ),
                duration_source=duration_source,
                resolution=f"{width}x{height}",
                orientation=orientation,
                fps=VIDEO_CFG.get("fps", 30),
                audio_included=audio_included,
                title=title
            )

            success += 1

            log(
                f"SUCCESS {relative} -> {output} "
                f"({actual_seconds:.2f}s)"
            )

        except Exception as error:

            audio_stop(audio_state)
            audio_state = None

            record_data.update(
                status="failed",
                finished_at=now(),
                error=str(error),
                traceback=traceback.format_exc()[-4000:]
            )

            failed += 1

            log(
                "FAILED "
                + relative
                + ": "
                + str(error)
            )

        finally:

            # Clean temporary files.
            for file in work.glob("*"):

                if file.is_file():

                    file.unlink(missing_ok=True)

            try:

                work.rmdir()

            except OSError:
                pass

        # ----------------------------------------------------
        # SAVE DATABASE
        # ----------------------------------------------------

        manifest["files"][relative] = record_data

        history.append(
            {
                key: record_data.get(key)
                for key in (
                    "html_filename",
                    "sha256",
                    "status",
                    "started_at",
                    "finished_at",
                    "output_filename",
                    "duration_seconds",
                    "detected_duration_seconds",
                    "duration_source",
                    "error"
                )
            }
        )

        save(MAN, manifest)
        save(HIST, history)

    # --------------------------------------------------------
    # FINAL SUMMARY
    # --------------------------------------------------------

    log(
        "SUMMARY "
        f"success={success}, "
        f"skipped={skipped}, "
        f"failed={failed}"
    )

    return 1 if failed else 0


if __name__ == "__main__":

    raise SystemExit(main())
