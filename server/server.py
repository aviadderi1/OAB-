# -*- coding: utf-8 -*-
"""
OAB (On Air Broadcast) server - your own internet radio server.
No installs needed: runs with the Python that is already on your computer.

Start:  double-click start-radio.bat   (or: python server.py)
Studio: http://localhost:8000/studio
Player: http://<your-computer-ip>:8000/
Phone studio: open the public https link + /mobile
"""
import atexit
import collections
import datetime
import hashlib
import json
import os
import queue
import random
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---------------- settings (change here) ----------------
PORT = int(os.environ.get("RADIO_PORT", "8000"))
PASSWORD = os.environ.get("RADIO_PASSWORD", "radio1234")   # studio / broadcast password
STATION = os.environ.get("RADIO_NAME", "OAB")
MAX_LISTENERS = int(os.environ.get("RADIO_MAX_LISTENERS", "0"))  # 0 = no limit
# ---------------------------------------------------------

VERSION = "1.3.0"
APP_DIR = os.path.dirname(os.path.abspath(__file__))            # program files (code + web)
BASE = os.environ.get("OAB_DATA") or APP_DIR                       # settings, playlists, recordings, downloaded tools
os.makedirs(BASE, exist_ok=True)
WEB = os.path.join(APP_DIR, "web")
REC_DIR = os.path.join(BASE, "recordings")
CONFIG_FILE = os.path.join(BASE, "config.json")
PLAYLISTS_FILE = os.path.join(BASE, "playlists.json")
DATA_DIR = os.path.join(BASE, "data")
VT_DIR = os.path.join(DATA_DIR, "voicetracks")
PLAYLOG_FILE = os.path.join(DATA_DIR, "playlog.csv")
os.makedirs(REC_DIR, exist_ok=True)
IS_WIN = sys.platform.startswith("win")
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".opus", ".webm"}

lock = threading.Lock()
listeners = {}                       # id -> Queue of mp3 chunks
listener_info = {}                   # lid -> {name, since, ip}
burst = collections.deque()          # last ~4 s of audio, sent at once so new listeners start instantly
BURST_BYTES = 96000
# Encoded MP3 silence (128 kbps, 44.1 kHz, stereo). Sent while nothing is on air,
# so listeners connect at once and hear the broadcast the moment it starts.
SILENCE_CHUNK = __import__("base64").b64decode(
    "//uSZECP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7kmRAj/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0"
    "gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVX/+5JkQI/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "TEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uSZECP8AAAaQAAAAgAAA0gAAAB"
    "AAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7kmRAj/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+5JkQI/wAABp"
    "AAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uSZECP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "Vf/7kmRAj/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+5JkQI/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAA"
    "NIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVV//uSZECP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==")  # 10 frames of encoded silence, ~0.26 s
next_id = [0]
next_req = [0]
art_cache = {}
st = {
    "title": "", "artist": "", "image": "",
    "last_push": 0.0, "last_live": 0.0, "peak": 0, "started": time.time(),
    "history": [], "requests": [],
    "rec_fh": None, "rec_name": "", "rec_started": 0.0,
    "source": "",
}

# ---------------- config ----------------
cfg = {"musicDir": "", "adsDir": "", "cartsDir": "", "autodj": True,
       "youtubeKey": "", "spotifyId": "", "spotifySecret": "", "googleClientId": ""}


def load_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    except Exception:
        pass
    if not cfg["musicDir"]:
        for cand in (os.path.join(BASE, "music"), os.path.join(os.path.expanduser("~"), "Music")):
            if os.path.isdir(cand):
                cfg["musicDir"] = cand
                break


def save_config():
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def now_hm():
    return datetime.datetime.now().strftime("%H:%M")


def on_air():
    return time.time() - st["last_push"] < 4


def silence_loop():
    """While nobody is on air, keep listeners connected with silence (no reconnect needed when the show starts)."""
    while True:
        time.sleep(0.26)
        if time.time() - st["last_push"] < 1.0:
            continue
        with lock:
            if time.time() - st["last_push"] > 6:
                burst.clear()
            dead = []
            for lid, q in listeners.items():
                if q.qsize() < 8:
                    try:
                        q.put_nowait(SILENCE_CHUNK)
                    except queue.Full:
                        dead.append(lid)
            for lid in dead:
                listeners.pop(lid, None)
                listener_info.pop(lid, None)


def live_source_active():
    return time.time() - st["last_live"] < 5


def broadcast(data, source):
    with lock:
        burst.append(data)
        total = sum(len(b) for b in burst)
        while len(burst) > 1 and total - len(burst[0]) >= BURST_BYTES:
            total -= len(burst.popleft())
        st["last_push"] = time.time()
        if source != "AutoDJ":
            st["last_live"] = time.time()
        st["source"] = source
        dead = []
        for lid, q in listeners.items():
            try:
                q.put_nowait(data)
            except queue.Full:
                dead.append(lid)          # listener too slow - drop it
        for lid in dead:
            listeners.pop(lid, None)
            listener_info.pop(lid, None)
        fh = st["rec_fh"]
        if fh:
            try:
                fh.write(data)
            except Exception:
                pass


# ---------------- ID3 tags ----------------
def _synch(b):
    return (b[0] << 21) | (b[1] << 14) | (b[2] << 7) | b[3]


def _text(b):
    if not b:
        return ""
    enc, s = b[0], b[1:]
    try:
        if enc == 0:
            t = s.decode("latin-1")
        elif enc == 1:
            t = s.decode("utf-16")
        elif enc == 2:
            t = s.decode("utf-16-be")
        else:
            t = s.decode("utf-8", "ignore")
    except Exception:
        t = s.decode("latin-1", "ignore")
    return t.replace("\x00", " ").strip()


def _picture(b, v22=False):
    try:
        enc = b[0]
        if v22:
            mime = "image/png" if b[1:4].upper() == b"PNG" else "image/jpeg"
            i = 4
        else:
            j = b.index(b"\x00", 1)
            mime = b[1:j].decode("latin-1") or "image/jpeg"
            i = j + 1
        i += 1  # picture type
        if enc in (1, 2):
            while i + 1 < len(b) and not (b[i] == 0 and b[i + 1] == 0):
                i += 2
            i += 2
        else:
            i = b.index(b"\x00", i) + 1
        if "/" not in mime:
            mime = "image/" + mime.lower().replace("jpg", "jpeg")
        return mime, b[i:]
    except Exception:
        return None


def id3_end(data):
    """Bytes to skip at the start of an MP3 (ID3v2 tag)."""
    if data[:3] == b"ID3" and len(data) >= 10:
        size = _synch(data[6:10]) + 10
        if data[5] & 0x10:
            size += 10
        return size
    return 0


def read_tags(path, want_pic=False):
    out = {}
    try:
        with open(path, "rb") as f:
            h = f.read(10)
            if len(h) < 10 or h[:3] != b"ID3":
                return out
            ver, flags, size = h[3], h[5], _synch(h[6:10])
            data = f.read(size)
    except Exception:
        return out
    pos = 0
    if flags & 0x40 and ver >= 3:
        pos = (_synch(data[0:4]) if ver == 4 else int.from_bytes(data[0:4], "big") + 4)
    hl = 6 if ver == 2 else 10
    names = {b"TT2": "title", b"TP1": "artist", b"TIT2": "title", b"TPE1": "artist"}
    while pos + hl <= len(data):
        if ver == 2:
            fid, fs = data[pos:pos + 3], int.from_bytes(data[pos + 3:pos + 6], "big")
        else:
            fid = data[pos:pos + 4]
            fs = _synch(data[pos + 4:pos + 8]) if ver == 4 else int.from_bytes(data[pos + 4:pos + 8], "big")
        if not fid or fid[0] == 0 or fs <= 0:
            break
        body = data[pos + hl:pos + hl + fs]
        pos += hl + fs
        if fid in names and names[fid] not in out:
            out[names[fid]] = _text(body)
        elif fid in (b"APIC", b"PIC") and "pic" not in out:
            out["pic"] = True
            if want_pic:
                out["picture"] = _picture(body, v22=(ver == 2))
    return out


def mp3_duration(path):
    """Fast duration estimate: Xing/Info frame count (VBR) or file size / bitrate (CBR)."""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            head = f.read(10)
            skip = 0
            if head[:3] == b"ID3":
                skip = _synch(head[6:10]) + 10
            f.seek(skip)
            data = f.read(65536)
        for pos, flen, dur in mp3_frames(data):
            hdr = data[pos:pos + 4]
            ver = (hdr[1] >> 3) & 3
            mono = ((hdr[3] >> 6) & 3) == 3
            spf = 1152 if ver == 3 else 576
            sr = SR[ver][(hdr[2] >> 2) & 3]
            off = (36 if not mono else 21) if ver == 3 else (21 if not mono else 13)
            tag = data[pos + off:pos + off + 4]
            if tag in (b"Xing", b"Info") and data[pos + off + 7] & 1:
                frames = int.from_bytes(data[pos + off + 8:pos + off + 12], "big")
                return round(frames * spf / sr, 2)
            bitrate = flen * sr / (spf / 8) if spf == 1152 else flen * sr / 72
            bri = (hdr[2] >> 4) & 15
            kbps = (BR1 if ver == 3 else BR2)[bri]
            return round((size - skip) * 8 / (kbps * 1000), 2) if kbps else 0
    except Exception:
        pass
    return 0


def name_guess(fn):
    base = os.path.splitext(os.path.basename(fn))[0].replace("_", " ")
    if " - " in base:
        a, t = base.split(" - ", 1)
        return t.strip(), a.strip()
    return base.strip(), ""


# ---------------- library (music / ads / carts folders) ----------------
library = {"music": [], "ads": [], "carts": []}
by_id = {}
scan_state = {"scanning": False}


def make_item(kind, full):
    fn = os.path.basename(full)
    tags = read_tags(full) if fn.lower().endswith(".mp3") else {}
    gt, ga = name_guess(fn)
    meta = yt_meta_get(full)
    iid = kind[0] + hashlib.sha1(full.encode("utf-8", "ignore")).hexdigest()[:12]
    return {"id": iid, "kind": kind, "full": full,
            "title": meta.get("title") or tags.get("title") or gt, "artist": meta.get("artist") or tags.get("artist") or ga,
            "cover": bool(tags.get("pic")), "thumb": meta.get("thumb", ""),
            "dur": meta.get("dur") or (mp3_duration(full) if fn.lower().endswith(".mp3") else 0)}


def add_file(kind, full):
    it = make_item(kind, full)
    with lock:
        old = by_id.get(it["id"])
        if old:
            library[kind] = [x for x in library[kind] if x["id"] != it["id"]]
        library[kind].append(it)
        by_id[it["id"]] = it
    return it


def scan_kind(kind):
    d = cfg.get(kind + "Dir") or ""
    items = []
    if d and os.path.isdir(d):
        for root, _, files in os.walk(d):
            for fn in files:
                if os.path.splitext(fn)[1].lower() not in AUDIO_EXT:
                    continue
                items.append(make_item(kind, os.path.join(root, fn)))
    items.sort(key=lambda x: (x["artist"].lower(), x["title"].lower()))
    with lock:
        for it in library[kind]:
            by_id.pop(it["id"], None)
        library[kind] = items
        for it in items:
            by_id[it["id"]] = it


def scan_all():
    if scan_state["scanning"]:
        return
    scan_state["scanning"] = True

    def work():
        try:
            for k in ("music", "ads", "carts"):
                scan_kind(k)
        finally:
            scan_state["scanning"] = False
    threading.Thread(target=work, daemon=True).start()


def public_item(it):
    return {"id": it["id"], "title": it["title"], "artist": it["artist"], "dur": it.get("dur", 0),
            "url": "/media/" + it["id"], "cover": ("/api/cover/" + it["id"]) if it["cover"] else it.get("thumb", ""),
            "path": it["full"]}


def browse(kind, rel):
    """Folder explorer inside the configured music / ads / jingles folders."""
    root = cfg.get(kind + "Dir") or ""
    if not root or not os.path.isdir(root):
        return {"error": "Folder not set", "dirs": [], "files": [], "path": ""}
    base = os.path.realpath(root)
    target = os.path.realpath(os.path.join(base, rel or ""))
    if not (target == base or target.startswith(base + os.sep)) or not os.path.isdir(target):
        target = base
    dirs, files = [], []
    with lock:
        index = {it["full"]: it for it in library.get(kind, [])}
    try:
        for name in sorted(os.listdir(target), key=str.lower):
            full = os.path.join(target, name)
            if os.path.isdir(full):
                dirs.append(name)
            elif os.path.splitext(name)[1].lower() in AUDIO_EXT and full in index:
                files.append(public_item(index[full]))
    except Exception:
        pass
    return {"dirs": dirs, "files": files, "path": os.path.relpath(target, base).replace("\\", "/") if target != base else "", "root": root}


# ---------------- MP3 frames (for AutoDJ pacing) ----------------
BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
SR = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def mp3_frames(data, pos=0):
    n = len(data)
    while pos + 4 <= n:
        if data[pos] == 0xFF and (data[pos + 1] & 0xE0) == 0xE0:
            ver = (data[pos + 1] >> 3) & 3
            layer = (data[pos + 1] >> 1) & 3
            bri = (data[pos + 2] >> 4) & 15
            sri = (data[pos + 2] >> 2) & 3
            pad = (data[pos + 2] >> 1) & 1
            if ver != 1 and layer == 1 and 0 < bri < 15 and sri != 3:
                sr = SR[ver][sri]
                if ver == 3:
                    flen, spf = 144 * BR1[bri] * 1000 // sr + pad, 1152
                else:
                    flen, spf = 72 * BR2[bri] * 1000 // sr + pad, 576
                if flen > 4 and pos + flen <= n:
                    yield pos, flen, spf / sr
                    pos += flen
                    continue
                if pos + flen > n:
                    return
        pos += 1


# ---------------- AutoDJ: plays the music folder when nobody is live ----------------
autodj = {"playing": "", "recent": collections.deque(maxlen=30)}


def autodj_loop():
    clock0, sent = 0.0, 0.0
    while True:
        time.sleep(0.5)
        if not cfg.get("autodj") or live_source_active():
            clock0 = 0.0
            autodj["playing"] = ""
            continue
        with lock:
            files = [it for it in library["music"] if it["full"].lower().endswith(".mp3")]
        if not files:
            continue
        choices = [f for f in files if f["id"] not in autodj["recent"]] or files
        it = random.choice(choices)
        autodj["recent"].append(it["id"])
        try:
            with open(it["full"], "rb") as f:
                data = f.read()
        except Exception:
            continue
        autodj["playing"] = it["title"]
        set_meta(it["title"], it["artist"])
        if clock0 == 0.0:
            clock0, sent = time.time(), 0.0
        batch, bdur = bytearray(), 0.0
        stopped = False
        for pos, flen, dur in mp3_frames(data, id3_end(data)):
            batch += data[pos:pos + flen]
            bdur += dur
            if bdur >= 0.25:
                if not cfg.get("autodj") or live_source_active():
                    stopped = True
                    break
                ahead = sent - (time.time() - clock0)
                if ahead > 1.0:
                    time.sleep(ahead - 1.0)
                broadcast(bytes(batch), "AutoDJ")
                sent += bdur
                batch, bdur = bytearray(), 0.0
        if batch and not stopped:
            broadcast(bytes(batch), "AutoDJ")
            sent += bdur
        if stopped:
            clock0 = 0.0
            autodj["playing"] = ""


# ---------------- now playing / artist images ----------------
def http_json(url, headers=None, data=None, timeout=8):
    req = urllib.request.Request(url, data=data, headers=headers or {"User-Agent": "RadioServer"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def artist_image(name):
    """Artist photo from Deezer's public API (no key needed). Cached."""
    name = (name or "").strip()
    if not name:
        return ""
    key = name.lower()
    if key in art_cache:
        return art_cache[key]
    img = ""
    try:
        d = http_json("https://api.deezer.com/search/artist?limit=1&q=" + urllib.parse.quote(name))
        items = d.get("data") or []
        if items:
            img = items[0].get("picture_big") or items[0].get("picture_medium") or ""
    except Exception:
        img = ""
    art_cache[key] = img
    return img


def set_meta(title, artist, kind="MUSIC"):
    title = (title or "").strip()[:200]
    artist = (artist or "").strip()[:200]
    with lock:
        st["title"], st["artist"], st["image"] = title, artist, ""
        if title or artist:
            st["history"].append({"time": now_hm(), "title": title, "artist": artist, "kind": kind, "image": ""})
            st["history"] = st["history"][-30:]
    if artist and kind == "MUSIC":
        def work():
            img = artist_image(artist)
            with lock:
                if st["artist"] == artist:
                    st["image"] = img
                for h in st["history"]:
                    if h["artist"] == artist and not h["image"]:
                        h["image"] = img
        threading.Thread(target=work, daemon=True).start()


# ---------------- online search ----------------
spotify_tok = {"t": "", "exp": 0}


def search(src, q):
    q = q.strip()
    if not q:
        return {"items": []}
    if src == "youtube" and cfg.get("youtubeKey"):
        d = http_json("https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q="
                      + urllib.parse.quote(q) + "&key=" + urllib.parse.quote(cfg["youtubeKey"]))
        out = []
        for it in d.get("items", []):
            sn = it.get("snippet", {})
            th = (sn.get("thumbnails") or {}).get("medium") or (sn.get("thumbnails") or {}).get("default") or {}
            out.append({"title": sn.get("title", ""), "artist": sn.get("channelTitle", ""), "image": th.get("url", ""), "dur": 0,
                        "videoId": (it.get("id") or {}).get("videoId", "")})
        return {"items": out, "source": "YouTube"}
    if src == "spotify" and cfg.get("spotifyId") and cfg.get("spotifySecret"):
        if time.time() > spotify_tok["exp"]:
            import base64
            auth = base64.b64encode((cfg["spotifyId"] + ":" + cfg["spotifySecret"]).encode()).decode()
            d = http_json("https://accounts.spotify.com/api/token", data=b"grant_type=client_credentials",
                          headers={"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"})
            spotify_tok["t"], spotify_tok["exp"] = d["access_token"], time.time() + d.get("expires_in", 3600) - 60
        d = http_json("https://api.spotify.com/v1/search?type=track&limit=10&q=" + urllib.parse.quote(q),
                      headers={"Authorization": "Bearer " + spotify_tok["t"]})
        out = []
        for t in (d.get("tracks") or {}).get("items", []):
            imgs = (t.get("album") or {}).get("images") or []
            out.append({"title": t.get("name", ""), "artist": ", ".join(a.get("name", "") for a in t.get("artists", [])),
                        "image": imgs[1]["url"] if len(imgs) > 1 else (imgs[0]["url"] if imgs else ""),
                        "dur": int((t.get("duration_ms") or 0) / 1000)})
        return {"items": out, "source": "Spotify"}
    # free fallback: Deezer catalogue (no key)
    d = http_json("https://api.deezer.com/search?limit=10&q=" + urllib.parse.quote(q))
    out = [{"title": t.get("title", ""), "artist": (t.get("artist") or {}).get("name", ""),
            "image": (t.get("album") or {}).get("cover_medium", ""), "dur": t.get("duration", 0)} for t in d.get("data", [])]
    note = "" if src == "web" else ("Add a YouTube API key in Settings for YouTube results." if src == "youtube"
                                    else "Add a Spotify Client ID and Secret in Settings for Spotify results.")
    return {"items": out, "source": "Web", "note": note}


# ---------------- public link (Cloudflare quick tunnel) ----------------
pub = {"proc": None, "url": "", "state": "off", "error": ""}


def cloudflared_path():
    return os.path.join(BASE, "cloudflared.exe" if IS_WIN else "cloudflared")


def start_public():
    if pub["state"] in ("starting", "on"):
        return

    def work():
        pub.update(state="starting", error="", url="")
        exe = cloudflared_path()
        try:
            if not os.path.isfile(exe):
                pub["state"] = "downloading"
                name = "cloudflared-windows-amd64.exe" if IS_WIN else "cloudflared-linux-amd64"
                url = "https://github.com/cloudflare/cloudflared/releases/latest/download/" + name
                tmp = exe + ".part"
                urllib.request.urlretrieve(url, tmp)
                os.replace(tmp, exe)
                if not IS_WIN:
                    os.chmod(exe, 0o755)
            pub["state"] = "starting"
            flags = 0x08000000 if IS_WIN else 0  # CREATE_NO_WINDOW
            p = subprocess.Popen([exe, "tunnel", "--no-autoupdate", "--url", "http://localhost:%d" % PORT],
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                 encoding="utf-8", errors="ignore", creationflags=flags)
            pub["proc"] = p
            tail = collections.deque(maxlen=4)
            for line in p.stdout:
                tail.append(line.strip())
                m = re.search(r"https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com", line)
                if m and not pub["url"]:
                    pub["url"] = m.group(0)
                    pub["state"] = "on"
                    print("  Public link: " + pub["url"])
            if pub["proc"] is p and not pub["url"]:
                pub.update(state="error", error=" | ".join(tail)[-200:] or "Could not create the link", url="", proc=None)
            elif pub["proc"] is p:
                pub.update(state="off", url="", proc=None)
        except Exception as e:
            pub.update(state="error", error=str(e)[:200], url="")
    threading.Thread(target=work, daemon=True).start()


def stop_public():
    p = pub.get("proc")
    if p:
        try:
            p.terminate()
        except Exception:
            pass
    pub.update(proc=None, state="off", url="")


atexit.register(stop_public)


# ---------------- status / recording ----------------
def recordings_list():
    out = []
    try:
        for f in sorted(os.listdir(REC_DIR), reverse=True)[:30]:
            if f.lower().endswith(".mp3"):
                p = os.path.join(REC_DIR, f)
                out.append({"name": f, "size": os.path.getsize(p)})
    except Exception:
        pass
    return out


def audience():
    now = time.time(); out = []
    with lock:
        for lid in listeners:
            i = listener_info.get(lid, {})
            out.append({"name": i.get("name") or "", "app": i.get("app", ""), "secs": int(now - i.get("since", now))})
    # the same person reconnecting may briefly appear twice: keep the longest connection per name
    seen = {}
    for a in out:
        k = a["name"].lower() or ("~" + str(len(seen)))
        if k not in seen or a["secs"] > seen[k]["secs"]:
            seen[k] = a
    return sorted(seen.values(), key=lambda a: -a["secs"])


MSG_FONTS = {"Heebo", "Rubik", "Assistant", "Varela Round", "Secular One", "Suez One", "Frank Ruhl Libre", "David Libre", "Alef", "Amatic SC", "Karantina", "Bellefair"}
station_msg = {"id": 0, "text": "", "t": 0, "font": "Heebo"}     # message from the studio to listeners on the app
MSG_TTL = 120                                    # seconds a message stays available (listeners poll every few seconds)


def status():
    with lock:
        m = station_msg if station_msg["text"] and time.time() - station_msg["t"] < MSG_TTL else None
        return {
            "msg": {"id": m["id"], "text": m["text"], "font": m.get("font", "Heebo"), "time": time.strftime("%H:%M", time.localtime(m["t"]))} if m else None,
            "station": STATION, "version": VERSION,
            "onAir": on_air(),
            "listeners": len(listeners),
            "peak": st["peak"],
            "title": st["title"], "artist": st["artist"], "image": st["image"],
            "history": list(reversed(st["history"][-12:])),
            "requests": list(reversed(st["requests"][-30:])),
            "recording": st["rec_fh"] is not None,
            "recName": st["rec_name"],
            "recSeconds": int(time.time() - st["rec_started"]) if st["rec_fh"] else 0,
            "recordings": recordings_list(),
            "uptime": int(time.time() - st["started"]),
            "source": st["source"] if on_air() else "",
            "autodj": bool(cfg.get("autodj")),
            "library": {k: len(v) for k, v in library.items()},
            "scanning": scan_state["scanning"],
            "public": {"state": pub["state"], "url": pub["url"], "error": pub["error"]},
            "lan": lan_link(),
        }


_lan = {"t": 0, "v": ""}


def lan_link():
    if time.time() - _lan["t"] > 60:
        _lan["v"] = "http://%s:%d/" % (lan_ip(), PORT)
        _lan["t"] = time.time()
    return _lan["v"]


def start_rec():
    with lock:
        if st["rec_fh"]:
            return st["rec_name"]
        name = "OAB-" + datetime.datetime.now().strftime("%Y-%m-%d_%H-%M") + ".mp3"
        st["rec_fh"] = open(os.path.join(REC_DIR, name), "ab")
        st["rec_name"] = name
        st["rec_started"] = time.time()
        return name


def stop_rec():
    with lock:
        fh = st["rec_fh"]
        st["rec_fh"] = None
        if fh:
            try:
                fh.close()
            except Exception:
                pass


MIME = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
        ".svg": "image/svg+xml", ".json": "application/json", ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".flac": "audio/flac",
        ".ogg": "audio/ogg", ".opus": "audio/ogg",
        ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".webm": "audio/webm", ".csv": "text/csv; charset=utf-8"}




# ---------------- YouTube link -> song in the music folder (yt-dlp) ----------------
YT_RE = re.compile(r"^https?://(www\.|m\.|music\.)?(youtube\.com/(watch\?|shorts/|live/|embed/)|youtu\.be/)\S+$", re.I)
ytjobs = {}
yt_tool_lock = threading.Lock()
_ytmeta_lock = threading.Lock()


def yt_meta_file(folder):
    return os.path.join(folder, "youtube-info.json")


def yt_meta_load(folder):
    try:
        with open(yt_meta_file(folder), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def yt_meta_get(full):
    folder = os.path.dirname(full)
    if not os.path.isfile(yt_meta_file(folder)):
        return {}
    return yt_meta_load(folder).get(os.path.basename(full), {})


def yt_meta_put(full, meta):
    folder = os.path.dirname(full)
    with _ytmeta_lock:
        d = yt_meta_load(folder)
        d[os.path.basename(full)] = meta
        with open(yt_meta_file(folder), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)


def ytdlp_exe():
    exe = os.path.join(BASE, "yt-dlp.exe" if IS_WIN else "yt-dlp")
    if os.path.isfile(exe):
        return exe
    url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/" + ("yt-dlp.exe" if IS_WIN else "yt-dlp")
    tmp = exe + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, exe)
    if not IS_WIN:
        os.chmod(exe, 0o755)
    return exe


def deno_exe():
    """YouTube now needs a JavaScript engine for yt-dlp. Deno is downloaded once into the Radio folder."""
    import shutil, zipfile
    exe = os.path.join(BASE, "deno.exe" if IS_WIN else "deno")
    if os.path.isfile(exe):
        return exe
    w = shutil.which("deno")
    if w:
        return w
    name = "deno-x86_64-pc-windows-msvc.zip" if IS_WIN else "deno-x86_64-unknown-linux-gnu.zip"
    tmp = exe + ".zip.part"
    urllib.request.urlretrieve("https://github.com/denoland/deno/releases/latest/download/" + name, tmp)
    with zipfile.ZipFile(tmp) as z:
        member = [n for n in z.namelist() if os.path.basename(n) in ("deno.exe", "deno")][0]
        with z.open(member) as src, open(exe + ".part", "wb") as dst:
            shutil.copyfileobj(src, dst)
    os.remove(tmp)
    os.replace(exe + ".part", exe)
    if not IS_WIN:
        os.chmod(exe, 0o755)
    return exe


def yt_log(lines):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(os.path.join(DATA_DIR, "youtube-log.txt"), "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n\n")
    except Exception:
        pass


def ffmpeg_exe():
    import shutil
    local = os.path.join(BASE, "ffmpeg.exe" if IS_WIN else "ffmpeg")
    return local if os.path.isfile(local) else shutil.which("ffmpeg")


JUNK = re.compile(r"\s*[\(\[][^\)\]]*(official|video|audio|lyric|clip|visuali[sz]er|hd|4k|hq|קליפ|רשמי)[^\)\]]*[\)\]]", re.I)


def yt_clean(title, artist, uploader, track):
    if track:
        return track.strip(), (artist or uploader or "").strip()
    t = JUNK.sub("", title or "").strip()
    if " - " in t:
        a, b = t.split(" - ", 1)
        return b.strip(), a.strip()
    up = re.sub(r"\s*-\s*Topic$|VEVO$", "", uploader or "", flags=re.I).strip()
    return t, (artist or up).strip()


def yt_job(jid, url):
    j = ytjobs[jid]
    try:
        music = cfg.get("musicDir") or ""
        if not music or not os.path.isdir(music):
            raise RuntimeError("Set the music folder in Settings > Options first")
        out_dir = os.path.join(music, "YouTube")
        os.makedirs(out_dir, exist_ok=True)
        # already downloaded?
        vid = re.search(r"(?:v=|youtu\.be/|shorts/|live/|embed/)([\w-]{11})", url)
        if vid:
            for name, m in yt_meta_load(out_dir).items():
                full = os.path.join(out_dir, name)
                if m.get("vid") == vid.group(1) and os.path.isfile(full):
                    j.update(state="done", progress=100, item=public_item(add_file("music", full)), note="Already in your library")
                    return
        j["state"] = "preparing"
        with yt_tool_lock:
            try:
                exe = ytdlp_exe()
            except Exception as e:
                raise RuntimeError("Could not download yt-dlp from GitHub (%s)" % str(e)[:80])
            j["state"] = "preparing-js"
            try:
                deno = deno_exe()
            except Exception as e:
                deno = ""
                yt_log(["[%s] Deno download failed: %s" % (now_hm(), e)])
        j["state"] = "downloading"
        ff = ffmpeg_exe()
        args = [exe, "--no-playlist", "--newline", "--no-mtime", "--windows-filenames", "--encoding", "utf-8",
                "-o", os.path.join(out_dir, "%(title).120B [%(id)s].%(ext)s"),
                "--js-runtimes", "deno:" + deno if deno else "deno",
                "--print", "after_move:RADIO\t%(filepath)s\t%(id)s\t%(title)s\t%(artist,creator)s\t%(uploader,channel)s\t%(track)s\t%(duration)s\t%(thumbnail)s"]
        if ff:
            args += ["-f", "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", "2", "--ffmpeg-location", ff]
        else:
            args += ["-f", "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio"]
        args.append(url)
        flags = 0x08000000 if IS_WIN else 0
        tail = collections.deque(maxlen=6)
        full_log = ["[%s] %s" % (now_hm(), url)]
        info = None
        for attempt in range(2):
            env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
            p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                 encoding="utf-8", errors="replace", creationflags=flags, env=env)
            for line in p.stdout:
                line = line.rstrip("\r\n")
                m = re.search(r"\[download\]\s+([\d.]+)%", line)
                if m:
                    j["progress"] = min(99.0, float(m.group(1)))
                elif line.startswith("RADIO\t"):
                    info = line.split("\t")
                elif line.strip():
                    tail.append(line.strip())
                    full_log.append(line.strip())
                    if "[ExtractAudio]" in line:
                        j["state"] = "converting"
            p.wait()
            if p.returncode == 0 and info:
                break
            if attempt == 0 and exe.startswith(BASE):   # YouTube changes often: update yt-dlp once and retry
                j["state"] = "updating"
                subprocess.run([exe, "-U"], capture_output=True, timeout=120, creationflags=flags)
                j["state"] = "downloading"
        if info and not os.path.isfile(info[1]) and info[2]:
            # name came back garbled: find the file by its video id
            cands = [os.path.join(out_dir, n) for n in os.listdir(out_dir) if "[%s]" % info[2] in n and not n.endswith((".part", ".ytdl", ".json"))]
            if cands:
                info[1] = max(cands, key=os.path.getmtime)
        if not info or not os.path.isfile(info[1]):
            yt_log(full_log)
            err = [t for t in tail if "ERROR" in t] or list(tail)
            raise RuntimeError((err[-1] if err else "Download failed").replace("ERROR: ", "")[:200])
        _, full, vid_, title, artist, uploader, track, dur, thumb = (info + [""] * 9)[:9]
        na = lambda v: "" if v in ("NA", "None") else v
        t, a = yt_clean(na(title), na(artist), na(uploader), na(track))
        try:
            d = float(na(dur) or 0)
        except ValueError:
            d = 0
        yt_meta_put(full, {"vid": vid_, "title": t, "artist": a, "thumb": na(thumb), "dur": d, "url": url})
        j.update(state="done", progress=100, item=public_item(add_file("music", full)))
    except Exception as e:
        j.update(state="error", error=str(e)[:200])


def yt_add(url):
    jid = "y%d%04d" % (int(time.time()), random.randint(0, 9999))
    ytjobs[jid] = {"id": jid, "url": url, "state": "queued", "progress": 0, "error": "", "item": None}
    for k in list(ytjobs)[:-50]:
        ytjobs.pop(k, None)
    threading.Thread(target=yt_job, args=(jid, url), daemon=True).start()
    return jid

# ---------------- studio data, play log, voice tracks, speech, weather, remote ----------------
STORE_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
remote_q = []
log_lock = threading.Lock()


def store_path(name):
    os.makedirs(DATA_DIR, exist_ok=True)
    return os.path.join(DATA_DIR, name + ".json")


def csv_cell(v):
    v = str(v if v is not None else "").replace("\r", " ").replace("\n", " ")
    return '"' + v.replace('"', '""') + '"' if any(c in v for c in ',"') else v


def play_log(d):
    os.makedirs(DATA_DIR, exist_ok=True)
    row = [datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), d.get("title", ""), d.get("artist", ""),
           d.get("type", ""), d.get("listeners", len(listeners)), d.get("dur", ""), d.get("playlist", "")]
    with log_lock:
        new = not os.path.exists(PLAYLOG_FILE)
        with open(PLAYLOG_FILE, "a", encoding="utf-8-sig" if new else "utf-8", newline="") as f:
            if new:
                f.write("time,title,artist,type,listeners,length,playlist\r\n")
            f.write(",".join(csv_cell(x) for x in row) + "\r\n")


def read_log(day_from, day_to):
    import csv
    rows = []
    if not os.path.exists(PLAYLOG_FILE):
        return rows
    with log_lock, open(PLAYLOG_FILE, "r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            d = (r.get("time") or "")[:10]
            if (not day_from or d >= day_from) and (not day_to or d <= day_to):
                rows.append(r)
    return rows


def tts_voices():
    if IS_WIN:
        ps = "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | % { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Culture }"
        try:
            out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=20,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
            return [{"name": l.split("|")[0], "lang": l.split("|")[-1]} for l in out.splitlines() if l.strip()]
        except Exception:
            return []
    import shutil
    return [{"name": "espeak", "lang": "many"}] if (shutil.which("espeak-ng") or shutil.which("espeak")) else []


def tts(text, voice=""):
    """Text to speech into a WAV file. Windows: built-in voices. Linux: espeak."""
    import shutil
    os.makedirs(VT_DIR, exist_ok=True)
    name = "tts_%d_%s.wav" % (int(time.time()), hashlib.md5((text + voice).encode("utf-8")).hexdigest()[:6])
    out = os.path.join(VT_DIR, name)
    text = text[:2000]
    if IS_WIN:
        ps = ("Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
              "if ($env:RADIO_VOICE) { try { $s.SelectVoice($env:RADIO_VOICE) } catch {} }; "
              "$s.SetOutputToWaveFile($env:RADIO_OUT); $s.Speak($env:RADIO_TEXT); $s.Dispose()")
        env = dict(os.environ, RADIO_TEXT=text, RADIO_OUT=out, RADIO_VOICE=voice or "")
        subprocess.run(["powershell", "-NoProfile", "-Command", ps], env=env, timeout=60, capture_output=True,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    else:
        exe = shutil.which("espeak-ng") or shutil.which("espeak")
        if not exe:
            raise RuntimeError("No speech engine on this computer")
        subprocess.run([exe, "-w", out, "--", text], timeout=60, capture_output=True)
    if not os.path.isfile(out) or os.path.getsize(out) < 100:
        raise RuntimeError("Speech engine did not produce audio")
    return "/vt/" + name


WMO = {0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "light drizzle",
       53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow",
       75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "heavy showers", 95: "thunderstorms",
       96: "thunderstorms with hail", 99: "thunderstorms with hail"}


def weather(city):
    g = json.load(urllib.request.urlopen("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + urllib.parse.quote(city), timeout=10))
    if not g.get("results"):
        raise RuntimeError("City not found")
    r = g["results"][0]
    w = json.load(urllib.request.urlopen("https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&latitude=%s&longitude=%s"
                                         % (r["latitude"], r["longitude"]), timeout=10))
    c = w.get("current", {})
    return {"city": r.get("name", city), "temp": round(c.get("temperature_2m", 0)), "desc": WMO.get(c.get("weather_code"), "")}


class Handler(BaseHTTPRequestHandler):
    server_version = "RadioServer/" + VERSION

    def log_message(self, fmt, *args):
        pass  # keep the window quiet

    # ---------- helpers ----------
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Radio-Key, Range")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def qs(self):
        return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

    def authed(self):
        key = self.headers.get("X-Radio-Key") or (self.qs().get("key") or [""])[0]
        if key == PASSWORD:
            return True
        auth = self.headers.get("Authorization", "")
        if auth.lower().startswith("basic "):
            import base64
            try:
                user, _, pw = base64.b64decode(auth[6:]).decode("utf-8", "ignore").partition(":")
                return pw == PASSWORD
            except Exception:
                return False
        return False

    def read_body(self, limit=2_000_000):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > limit:
            return b""
        return self.rfile.read(n)

    def read_json(self, limit=20000):
        try:
            return json.loads(self.read_body(limit) or b"{}")
        except Exception:
            return {}

    def send_path(self, full, attachment=False):
        """Static file with Range support (needed for seeking in audio)."""
        ext = os.path.splitext(full)[1].lower()
        size = os.path.getsize(full)
        start, end = 0, size - 1
        rng = self.headers.get("Range", "")
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:
                start = max(0, size - int(m.group(2)))
            end = min(end, size - 1)
            if start > end:
                self.send_response(416)
                self.send_header("Content-Range", "bytes */%d" % size)
                self.end_headers()
                return
            self.send_response(206)
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        else:
            self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        if attachment:
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % os.path.basename(full))
        self.cors()
        self.end_headers()
        with open(full, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                b = f.read(min(65536, left))
                if not b:
                    break
                self.wfile.write(b)
                left -= len(b)

    def player_page(self):
        """Listener page with link-preview tags (WhatsApp / Facebook show a big 'listen' card)."""
        proto = (self.headers.get("X-Forwarded-Proto") or "http").split(",")[0].strip()
        host = re.sub(r"[^\w.:\-\[\]]", "", self.headers.get("Host") or "localhost")
        with open(os.path.join(WEB, "index.html"), "r", encoding="utf-8") as f:
            body = f.read().replace("{{BASE}}", "%s://%s" % (proto, host)).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, path):
        full = os.path.realpath(path)
        in_web = full.startswith(os.path.realpath(WEB) + os.sep)
        in_rec = full.startswith(os.path.realpath(REC_DIR) + os.sep) or full.startswith(os.path.realpath(VT_DIR) + os.sep)
        if not (in_web or in_rec) or not os.path.isfile(full):
            self.send_json({"error": "not found"}, 404)
            return
        self.send_path(full, attachment=in_rec)

    # ---------- listeners ----------
    def stream(self):
        with lock:
            if MAX_LISTENERS and len(listeners) >= MAX_LISTENERS:
                full = True
            else:
                full = False
                next_id[0] += 1
                lid = next_id[0]
                q = queue.Queue(maxsize=400)
                first = b"".join(burst) or SILENCE_CHUNK * 20
                listeners[lid] = q
                nm = re.sub(r"[\x00-\x1f<>]", "", (self.qs().get("name") or [""])[0]).strip()[:30]
                ua = self.headers.get("User-Agent", "")
                listener_info[lid] = {"name": nm, "since": time.time(), "ip": self.client_address[0], "app": "" if nm else ("VLC" if "VLC" in ua else "Other player")}
                st["peak"] = max(st["peak"], len(listeners))
        if full:
            self.send_json({"error": "station full"}, 503)
            return
        try:
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Cache-Control", "no-cache, no-store")
            self.send_header("icy-name", STATION)
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(first)
            self.wfile.flush()
            while True:
                try:
                    chunk = q.get(timeout=10)
                except queue.Empty:
                    with lock:
                        if lid not in listeners:
                            break
                    continue
                self.wfile.write(chunk)
                self.wfile.flush()
        except Exception:
            pass
        finally:
            with lock:
                listeners.pop(lid, None)
                listener_info.pop(lid, None)

    # ---------- Icecast-compatible source (BUTT, Mixxx, mobile apps) ----------
    def icecast_source(self):
        if not self.authed():
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="OAB"')
            self.end_headers()
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.flush()
        name = self.headers.get("ice-name") or "Icecast source"
        left = int(self.headers.get("Content-Length") or 0)   # 0 = endless live stream
        try:
            while True:
                want = 16384 if left <= 0 else min(16384, left)
                data = self.rfile.read1(want)
                if not data:
                    break
                broadcast(data, name)
                if left > 0:
                    left -= len(data)
                    if left <= 0:
                        break
        except Exception:
            pass

    def proxy(self, url):
        if not re.match(r"^https?://", url or ""):
            return self.send_json({"error": "bad url"}, 400)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 OAB/" + VERSION, "Icy-MetaData": "0"})
            r = urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            return self.send_json({"error": str(e)[:150]}, 502)
        try:
            self.send_response(200)
            self.send_header("Content-Type", r.headers.get("Content-Type") or "audio/mpeg")
            if r.headers.get("Content-Length"):
                self.send_header("Content-Length", r.headers.get("Content-Length"))
            self.send_header("Cache-Control", "no-cache")
            self.cors()
            self.end_headers()
            while True:
                b = r.read(16384)
                if not b:
                    break
                self.wfile.write(b)
        except Exception:
            pass
        finally:
            try:
                r.close()
            except Exception:
                pass

    def do_SOURCE(self):
        self.icecast_source()

    def do_PUT(self):
        self.icecast_source()

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    # ---------- GET ----------
    def do_HEAD(self):
        """Link previews (WhatsApp, Facebook, Telegram) often ask HEAD first: answer like GET, without the body."""
        p = urllib.parse.urlparse(self.path).path
        if p in ("/live", "/live.mp3", "/stream", "/stream.mp3"):
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Cache-Control", "no-cache, no-store")
            self.end_headers()
            return

        class HeadOnly:
            def __init__(self, real):
                self.real, self.done = real, False
            def write(self, b):
                if not self.done:
                    self.done = True
                    return self.real.write(b)      # the header block
                return len(b)                       # drop the body
            def flush(self):
                return self.real.flush()
        real = self.wfile
        self.wfile = HeadOnly(real)
        try:
            self.do_GET()
        finally:
            self.wfile = real

    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        if p in ("/live", "/live.mp3", "/stream", "/stream.mp3"):
            return self.stream()
        if p == "/api/status":
            d = status()
            if self.authed():
                d["audience"] = audience()
            return self.send_json(d)
        if p == "/api/artist":
            return self.send_json({"image": artist_image((self.qs().get("name") or [""])[0])})
        if p == "/api/library":
            kind = (self.qs().get("kind") or ["music"])[0]
            with lock:
                items = [public_item(it) for it in library.get(kind, [])]
            return self.send_json({"items": items, "scanning": scan_state["scanning"], "dir": cfg.get(kind + "Dir", "")})
        if p.startswith("/media/"):
            it = by_id.get(p[len("/media/"):])
            if not it or not os.path.isfile(it["full"]):
                return self.send_json({"error": "not found"}, 404)
            return self.send_path(it["full"])
        if p.startswith("/api/cover/"):
            it = by_id.get(p[len("/api/cover/"):])
            pic = read_tags(it["full"], want_pic=True).get("picture") if it else None
            if not pic:
                return self.send_json({"error": "no cover"}, 404)
            mime, data = pic
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "max-age=86400")
            self.end_headers()
            self.wfile.write(data)
            return
        if p == "/api/browse":
            q = self.qs()
            return self.send_json(browse((q.get("kind") or ["music"])[0], (q.get("path") or [""])[0]))
        if p == "/api/playlists":
            if not self.authed():
                return self.send_json({"error": "wrong password"}, 401)
            try:
                with open(PLAYLISTS_FILE, "r", encoding="utf-8") as f:
                    return self.send_json(json.load(f))
            except Exception:
                return self.send_json({})
        if p == "/proxy":                    # network streams / podcasts, so the studio can mix them
            if not self.authed():
                return self.send_json({"error": "wrong password"}, 401)
            return self.proxy((self.qs().get("url") or [""])[0])
        if p == "/api/search":
            q = self.qs()
            try:
                return self.send_json(search((q.get("src") or ["web"])[0], (q.get("q") or [""])[0]))
            except Exception as e:
                return self.send_json({"items": [], "note": "Search failed: " + str(e)[:120]})
        if p == "/api/config":
            if not self.authed():
                return self.send_json({"error": "wrong password"}, 401)
            safe = dict(cfg)
            safe["spotifySecret"] = "********" if cfg.get("spotifySecret") else ""
            return self.send_json(safe)
        if p == "/admin/metadata":           # Icecast-style metadata update (BUTT etc.)
            if not self.authed():
                return self.send_json({"error": "auth"}, 401)
            song = (self.qs().get("song") or [""])[0]
            artist, _, title = song.partition(" - ")
            if not title:
                artist, title = "", song
            set_meta(title, artist)
            return self.send_json({"ok": True})
        if p in ("/", "/index.html", "/listen"):
            return self.player_page()
        if p in ("/studio", "/studio/", "/studio.html"):
            return self.serve_file(os.path.join(WEB, "studio.html"))
        if p in ("/spotify-callback", "/spotify-callback/"):
            return self.serve_file(os.path.join(WEB, "spotify-callback.html"))
        if p in ("/mobile", "/mobile/", "/mobile.html"):
            return self.serve_file(os.path.join(WEB, "mobile.html"))
        if p.startswith("/vt/"):
            return self.serve_file(os.path.join(VT_DIR, urllib.parse.unquote(p[len("/vt/"):])))
        if p in ("/remote", "/remote/"):
            return self.serve_file(os.path.join(WEB, "remote.html"))
        if p == "/api/weather":
            try:
                return self.send_json(weather((self.qs().get("city") or [cfg.get("city") or "Tel Aviv"])[0]))
            except Exception as e:
                return self.send_json({"error": str(e)[:150]}, 502)
        if p == "/api/yt/job":
            if not self.authed():
                return self.send_json({"error": "wrong password"}, 401)
            j = ytjobs.get((self.qs().get("id") or [""])[0])
            return self.send_json(j or {"state": "error", "error": "Download was lost (server restarted)"}, 200)
        if p.startswith("/api/store/") or p in ("/api/playlog", "/api/remote", "/api/tts/voices"):
            if not self.authed():
                return self.send_json({"error": "wrong password"}, 401)
            if p == "/api/playlog":
                q = self.qs()
                return self.send_json({"rows": read_log((q.get("from") or [""])[0], (q.get("to") or [""])[0])})
            if p == "/api/remote":
                with lock:
                    cmds = remote_q[:]
                    del remote_q[:]
                return self.send_json({"cmds": cmds})
            if p == "/api/tts/voices":
                return self.send_json({"voices": tts_voices()})
            name = p[len("/api/store/"):]
            if not STORE_RE.match(name):
                return self.send_json({"error": "bad name"}, 400)
            try:
                with open(store_path(name), "r", encoding="utf-8") as f:
                    return self.send_json(json.load(f))
            except Exception:
                return self.send_json(None)
        if p.startswith("/recordings/"):
            return self.serve_file(os.path.join(REC_DIR, urllib.parse.unquote(p[len("/recordings/"):])))
        return self.serve_file(os.path.join(WEB, urllib.parse.unquote(p.lstrip("/"))))

    # ---------- POST ----------
    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        if p == "/api/request":                  # public: listeners ask for a song
            d = self.read_json(10000)
            song = str(d.get("song", "")).strip()[:120]
            who = str(d.get("name", "")).strip()[:40]
            if not song or not who:
                return self.send_json({"error": "song and name are required"}, 400)
            with lock:
                next_req[0] += 1
                st["requests"].append({"id": next_req[0], "time": now_hm(), "song": song, "name": who})
                st["requests"] = st["requests"][-50:]
            return self.send_json({"ok": True})

        if not self.authed():
            return self.send_json({"error": "wrong password"}, 401)

        if p == "/api/push":                     # studio sends MP3 audio
            data = self.read_body()
            if data:
                broadcast(data, self.headers.get("X-Radio-Source") or "Studio")
            return self.send_json({"ok": True, "listeners": len(listeners)})
        if p == "/api/message":                  # studio → message on every listener's screen
            d = self.read_json(20000)
            text = str(d.get("text", "")).strip()[:500]
            font = d.get("font") if d.get("font") in MSG_FONTS else "Heebo"
            with lock:
                station_msg["font"] = font
                station_msg["id"] = int(time.time() * 1000)
                station_msg["text"] = text
                station_msg["t"] = time.time()
            return self.send_json({"ok": True, "listeners": len(listeners)})
        if p == "/api/meta":
            d = self.read_json()
            set_meta(d.get("title"), d.get("artist"), d.get("kind") or "MUSIC")
            return self.send_json({"ok": True})
        if p == "/api/rec":
            if self.read_json(1000).get("on"):
                return self.send_json({"ok": True, "name": start_rec()})
            stop_rec()
            return self.send_json({"ok": True})
        if p == "/api/requests/clear":
            with lock:
                st["requests"] = []
            return self.send_json({"ok": True})
        if p == "/api/config":
            d = self.read_json()
            for k in ("musicDir", "adsDir", "cartsDir", "youtubeKey", "spotifyId", "googleClientId", "city", "ttsVoice"):
                if k in d:
                    cfg[k] = str(d[k]).strip().strip('"')
            if d.get("spotifySecret") and d["spotifySecret"] != "********":
                cfg["spotifySecret"] = str(d["spotifySecret"]).strip()
            if "autodj" in d:
                cfg["autodj"] = bool(d["autodj"])
            save_config()
            bad = [k for k in ("musicDir", "adsDir", "cartsDir") if cfg.get(k) and not os.path.isdir(cfg[k])]
            scan_all()
            return self.send_json({"ok": True, "missing": bad})
        if p == "/api/playlists":
            data = self.read_body(20_000_000)
            try:
                json.loads(data or b"{}")
                with open(PLAYLISTS_FILE, "wb") as f:
                    f.write(data)
                return self.send_json({"ok": True})
            except Exception:
                return self.send_json({"error": "bad data"}, 400)
        if p == "/api/rescan":
            scan_all()
            return self.send_json({"ok": True})
        if p == "/api/public":
            if self.read_json(1000).get("on"):
                start_public()
            else:
                stop_public()
            return self.send_json({"ok": True})
        if p.startswith("/api/store/"):
            name = p[len("/api/store/"):]
            data = self.read_body(20_000_000)
            if not STORE_RE.match(name):
                return self.send_json({"error": "bad name"}, 400)
            try:
                json.loads(data or b"null")
                with open(store_path(name), "wb") as f:
                    f.write(data)
                return self.send_json({"ok": True})
            except Exception:
                return self.send_json({"error": "bad data"}, 400)
        if p == "/api/yt/add":
            url = str(self.read_json(4000).get("url", "")).strip()
            if not YT_RE.match(url):
                return self.send_json({"error": "This is not a YouTube song link"}, 400)
            return self.send_json({"ok": True, "job": yt_add(url)})
        if p == "/api/log":
            play_log(self.read_json())
            return self.send_json({"ok": True})
        if p == "/api/remote":
            cmd = str(self.read_json(2000).get("cmd", ""))[:80]
            if cmd:
                with lock:
                    remote_q.append(cmd)
                    del remote_q[:-20]
            return self.send_json({"ok": True})
        if p == "/api/upload":
            nm = re.sub(r"[^\w\- .]", "_", (self.qs().get("name") or ["voicetrack.webm"])[0])[:80]
            data = self.read_body(80_000_000)
            if not data:
                return self.send_json({"error": "empty"}, 400)
            os.makedirs(VT_DIR, exist_ok=True)
            base, ext = os.path.splitext(nm)
            fn = "%s_%s%s" % (datetime.datetime.now().strftime("%Y%m%d-%H%M%S"), base, ext or ".webm")
            with open(os.path.join(VT_DIR, fn), "wb") as f:
                f.write(data)
            return self.send_json({"ok": True, "url": "/vt/" + fn})
        if p == "/api/tts":
            d = self.read_json(10000)
            try:
                return self.send_json({"ok": True, "url": tts(str(d.get("text", "")), str(d.get("voice", "")))})
            except Exception as e:
                return self.send_json({"error": str(e)[:200]}, 500)
        if p == "/api/check":
            return self.send_json({"ok": True})
        return self.send_json({"error": "not found"}, 404)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def get_request(self):
        conn, addr = self.socket.accept()
        try:
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass
        return conn, addr
    allow_reuse_address = True
    request_queue_size = 256


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    load_config()
    try:
        srv = Server(("0.0.0.0", PORT), Handler)
    except OSError:
        print("Port %d is busy. Close the other program or set RADIO_PORT." % PORT)
        input("Press Enter to exit")
        return
    scan_all()
    threading.Thread(target=autodj_loop, daemon=True).start()
    threading.Thread(target=silence_loop, daemon=True).start()
    ip = lan_ip()
    print("=" * 60)
    print("  %s server %s is running" % (STATION, VERSION))
    print("  Studio (this computer):  http://127.0.0.1:%d/studio" % PORT)
    print("  Player (home network):   http://%s:%d/" % (ip, PORT))
    print("  Stream link for apps:    http://%s:%d/live.mp3" % (ip, PORT))
    print("  Music folder:            %s" % (cfg["musicDir"] or "(set it in the studio settings)"))
    print("  Password: %s   (change it at the top of server.py)" % PASSWORD)
    print("  Keep this window open. AutoDJ plays when nobody is live.")
    print("=" * 60)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop_rec()
        stop_public()


if __name__ == "__main__":
    main()
