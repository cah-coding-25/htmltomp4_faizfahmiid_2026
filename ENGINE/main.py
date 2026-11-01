import json, hashlib, subprocess, traceback, os, time
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"HTML"; VIDEO=ROOT/"VIDEO"; DB=ROOT/"DATABASE"
TEMP=ROOT/"TEMP"; LOG=ROOT/"LOGS"/"render.log"
MAN=DB/"render_manifest.json"; HIST=DB/"render_history.json"
CFG=json.loads((ROOT/"CONFIG"/"settings.json").read_text(encoding="utf-8"))

def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds")
def log(s):
    LOG.parent.mkdir(parents=True,exist_ok=True)
    line=f"[{now()}] {s}"; print(line,flush=True)
    with LOG.open("a",encoding="utf-8") as f: f.write(line+"\\n")
def read(path,default):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except Exception: return default
def save(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+".tmp")
    tmp.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\\n",encoding="utf-8")
    os.replace(tmp,path)
def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()
def meta(path):
    from html.parser import HTMLParser
    class P(HTMLParser):
        def __init__(self): super().__init__(); self.m={}; self.title=""; self.t=False
        def handle_starttag(self,t,a):
            a=dict(a)
            if t=="meta" and (a.get("name","").startswith("render-")): self.m[a["name"][7:]]=a.get("content","")
            if t=="html":
                for k in ("duration","orientation","width","height"):
                    key="data-render-"+k
                    if key in a:self.m[k]=a[key]
            if t=="title":self.t=True
        def handle_data(self,d):
            if self.t:self.title+=d
        def handle_endtag(self,t):
            if t=="title":self.t=False
    p=P(); p.feed(path.read_text(encoding="utf-8",errors="replace"))
    dur=max(CFG["duration"]["min_seconds"],min(float(p.m.get("duration",CFG["duration"]["default_seconds"])),CFG["duration"]["max_seconds"]))
    orient=p.m.get("orientation","auto").lower()
    if p.m.get("width") and p.m.get("height"): w,h=int(p.m["width"]),int(p.m["height"])
    else:
        orient=CFG["video"]["default_orientation"] if orient=="auto" else orient
        size=CFG["video"]["portrait"] if orient=="portrait" else CFG["video"]["landscape"]
        w,h=size["width"],size["height"]
    return dur,w,h,orient,p.title.strip()
def audio_start(wav):
    if not CFG["audio"]["enabled"]:return None
    subprocess.run(["pulseaudio","--start","--exit-idle-time=-1","--daemonize=yes"],check=False)
    time.sleep(2)
    r=subprocess.run(["pactl","load-module","module-null-sink","sink_name=html_render"],capture_output=True,text=True,check=True)
    module=r.stdout.strip()
    subprocess.run(["pactl","set-default-sink","html_render"],check=True)
    proc=subprocess.Popen(["ffmpeg","-y","-f","pulse","-i","html_render.monitor","-ac",str(CFG["audio"]["channels"]),"-ar",str(CFG["audio"]["sample_rate"]),"-c:a","pcm_s16le",str(wav)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    return proc,module
def audio_stop(state):
    if state:
        proc,module=state
        if proc.poll() is None:
            proc.terminate()
            try:proc.wait(timeout=8)
            except subprocess.TimeoutExpired:proc.kill()
        subprocess.run(["pactl","unload-module",module],capture_output=True)
def record(src,folder,w,h,duration):
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--autoplay-policy=no-user-gesture-required","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":w,"height":h},device_scale_factor=1,record_video_dir=str(folder),record_video_size={"width":w,"height":h},reduced_motion="no-preference")
        page=context.new_page()
        page.add_init_script("""window.__renderDone=false;window.addEventListener('html-render-done',()=>window.__renderDone=true);window.addEventListener('render:done',()=>window.__renderDone=true);""")
        page.on("pageerror",lambda e:errors.append(str(e)))
        try:
            page.goto(src.resolve().as_uri(),wait_until="load",timeout=CFG["browser"]["navigation_timeout_ms"])
            try:page.evaluate("document.fonts.ready")
            except Exception:pass
            page.wait_for_timeout(CFG["browser"]["wait_before_recording_ms"])
            if CFG["duration"]["allow_early_done_signal"]:
                try:page.wait_for_function("()=>window.__renderDone===true || window.HTML_MP4_RENDER_DONE===true",timeout=int(duration*1000),polling=100)
                except Exception:log(f"Done signal tidak diterima; durasi batas {duration}s digunakan.")
            else:page.wait_for_timeout(int(duration*1000))
        finally:
            v=page.video
            context.close(); browser.close()
            path=Path(v.path()) if v else None
        if errors:log("JS errors: "+" | ".join(errors[:5]))
    if not path or not path.exists() or not path.stat().st_size:raise RuntimeError("Rekaman Chromium kosong.")
    return path
def encode(webm,wav,out):
    use_audio=CFG["audio"]["enabled"] and wav.exists() and wav.stat().st_size>44
    cmd=["ffmpeg","-y","-i",str(webm)]
    if use_audio:cmd+=["-i",str(wav)]
    cmd += ["-vf",f'fps={CFG["video"]["fps"]},format=yuv420p',"-c:v",CFG["video"]["codec"],"-preset",CFG["video"]["preset"],"-crf",str(CFG["video"]["crf"]),"-movflags","+faststart"]
    cmd += (["-c:a","aac","-b:a",CFG["audio"]["bitrate"],"-af","aresample=async=1:first_pts=0","-shortest"] if use_audio else ["-an"])
    cmd.append(str(out))
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode:raise RuntimeError("FFmpeg: "+r.stderr[-2500:])
    q=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(out)],capture_output=True,text=True)
    if q.returncode or not q.stdout.strip():raise RuntimeError("MP4 gagal validasi ffprobe.")
    return float(q.stdout.strip()),use_audio
def main():
    for tool in ("ffmpeg","ffprobe"): 
        if not __import__("shutil").which(tool):raise RuntimeError(tool+" tidak ditemukan.")
    if CFG["audio"]["enabled"]:
        for tool in ("pulseaudio","pactl"):
            if not __import__("shutil").which(tool):raise RuntimeError(tool+" dibutuhkan untuk audio.")
    HTML.mkdir(exist_ok=True);VIDEO.mkdir(exist_ok=True);TEMP.mkdir(exist_ok=True)
    manifest=read(MAN,{"schema_version":2,"files":{}}); history=read(HIST,[])
    manifest.setdefault("files",{})
    sources=sorted(x for x in HTML.rglob("*.html") if x.is_file())
    if not sources:log("Tidak ada HTML.");return 0
    ok=skip=fail=0
    for src in sources:
        rel=src.relative_to(HTML).as_posix(); digest=sha(src); out=(VIDEO/Path(rel)).with_suffix(".mp4")
        old=manifest["files"].get(rel,{})
        if old.get("status")=="success" and old.get("sha256")==digest and out.exists() and out.stat().st_size:
            skip+=1;log("SKIP "+rel);continue
        rec={"html_filename":rel,"sha256":digest,"output_filename":out.relative_to(VIDEO).as_posix(),"status":"processing","started_at":now()}
        manifest["files"][rel]=rec;save(MAN,manifest)
        work=TEMP/(src.stem+"-"+digest[:8]);work.mkdir(parents=True,exist_ok=True)
        wav=work/"audio.wav"; state=None
        try:
            if src.stat().st_size==0 or ("<html" not in src.read_text(encoding="utf-8",errors="replace").lower() and "<!doctype html" not in src.read_text(encoding="utf-8",errors="replace").lower()):raise RuntimeError("Dokumen HTML kosong/tidak valid.")
            duration,w,h,orient,title=meta(src)
            state=audio_start(wav)
            webm=record(src,work,w,h,duration)
            audio_stop(state);state=None
            seconds,aud=encode(webm,wav,out)
            rec.update(status="success",finished_at=now(),duration_seconds=round(seconds,3),resolution=f"{w}x{h}",orientation=orient,fps=CFG["video"]["fps"],audio_included=aud,title=title)
            ok+=1;log(f"SUCCESS {rel} -> {out}")
        except Exception as e:
            audio_stop(state);rec.update(status="failed",finished_at=now(),error=str(e),traceback=traceback.format_exc()[-4000:])
            fail+=1;log("FAILED "+rel+": "+str(e))
        finally:
            for f in work.glob("*"):
                if f.is_file():f.unlink(missing_ok=True)
            try:work.rmdir()
            except OSError:pass
        manifest["files"][rel]=rec
        history.append({k:rec.get(k) for k in ("html_filename","sha256","status","finished_at","output_filename","error")})
        save(MAN,manifest);save(HIST,history)
    log(f"SUMMARY success={ok}, skipped={skip}, failed={fail}")
    return 1 if fail else 0
if __name__=="__main__":raise SystemExit(main())
