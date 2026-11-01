"""Mohaseb Pro — system tray companion (Windows).

Runs in the logged-in user's session (launched from the Startup
folder shortcut the installer creates). It shows at a glance whether
the MohasebPro server service is running — like the Plex tray icon —
and offers the everyday controls next to the clock:

* open the app (localhost) / copy the LAN address for other devices,
* start / stop / restart the server service,
* open the logs folder or the data folder.

Exiting the tray app does NOT stop the server; the service keeps
running in the background. Start/stop works without elevation
because install-services.ps1 grants local users start/stop rights
on the service.

Only third-party imports are pystray + Pillow (packaging-only deps,
see ../tray-requirements.txt); everything else is stdlib.
"""

from __future__ import annotations

import configparser
import ctypes
import os
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

import pystray
from PIL import Image, ImageDraw, ImageFont

SERVICE = "MohasebPro"
APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "MohasebPro"
LOG_DIR = DATA_DIR / "logs"
CREATE_NO_WINDOW = 0x08000000

# sc.exe service state codes
STOPPED, START_PENDING, STOP_PENDING, RUNNING = 1, 2, 3, 4
STATE_TEXT = {
    STOPPED: "متوقف",
    START_PENDING: "در حال شروع…",
    STOP_PENDING: "در حال توقف…",
    RUNNING: "در حال اجرا",
    0: "نصب نیست",
}
STATE_COLOR = {
    STOPPED: (156, 163, 175),
    START_PENDING: (245, 158, 11),
    STOP_PENDING: (245, 158, 11),
    RUNNING: (16, 185, 129),
    0: (220, 38, 38),
}
BRAND = (79, 70, 229)  # indigo — matches the app's primary gradient


def read_port() -> int:
    cfg = configparser.ConfigParser()
    try:
        cfg.read(DATA_DIR / "config.ini", encoding="utf-8-sig")
        return cfg.getint("app", "port", fallback=4173)
    except Exception:
        return 4173


def service_state() -> int:
    try:
        out = subprocess.run(
            ["sc", "query", SERVICE], capture_output=True, text=True,
            timeout=10, creationflags=CREATE_NO_WINDOW,
        ).stdout
    except Exception:
        return 0
    for line in out.splitlines():
        if "STATE" in line and ":" in line:
            try:
                return int(line.split(":", 1)[1].strip().split()[0])
            except (ValueError, IndexError):
                return 0
    return 0


def sc(*args: str) -> int:
    try:
        return subprocess.run(
            ["sc", *args], capture_output=True, timeout=30,
            creationflags=CREATE_NO_WINDOW,
        ).returncode
    except Exception:
        return 1


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))  # UDP "connect" sends nothing
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"
    finally:
        sock.close()


def make_icon(state: int) -> Image.Image:
    size = 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([8, 8, size - 8, size - 8], radius=28, fill=BRAND)
    font = None
    for candidate in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
        if Path(candidate).exists():
            try:
                font = ImageFont.truetype(candidate, 72)
                break
            except OSError:
                pass
    if font is None:
        font = ImageFont.load_default()
    draw.text((size / 2, size / 2 - 6), "M", font=font, fill="white", anchor="mm")
    # status dot, bottom-right
    dot_r = 17
    cx, cy = size - 30, size - 30
    draw.ellipse([cx - dot_r - 4, cy - dot_r - 4, cx + dot_r + 4, cy + dot_r + 4],
                 fill="white")
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
                 fill=STATE_COLOR.get(state, STATE_COLOR[0]))
    return img


class Tray:
    def __init__(self) -> None:
        self.port = read_port()
        self.state = service_state()
        self.icon = pystray.Icon(
            "mohaseb-pro", make_icon(self.state),
            "محاسب پرو", menu=self._menu(),
        )

    # ---- menu ------------------------------------------------------
    def _menu(self) -> pystray.Menu:
        state = self.state
        running = state == RUNNING
        busy = state in (START_PENDING, STOP_PENDING)
        ip = lan_ip()
        return pystray.Menu(
            pystray.MenuItem(
                f"محاسب پرو — {STATE_TEXT.get(state, '?')}", None, enabled=False),
            pystray.MenuItem(
                f"باز کردن محاسب پرو (localhost:{self.port})",
                lambda: webbrowser.open(f"http://localhost:{self.port}"),
                default=True),
            pystray.MenuItem(
                f"آدرس شبکه: http://{ip}:{self.port} (کپی)",
                lambda: self._copy(f"http://{ip}:{self.port}")),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("شروع سرور", lambda: self._control("start"),
                             visible=not running and not busy),
            pystray.MenuItem("توقف سرور", lambda: self._control("stop"),
                             visible=running),
            pystray.MenuItem("راه‌اندازی مجدد سرور", lambda: self._restart(),
                             visible=running),
            pystray.MenuItem("سرور در حال تغییر وضعیت است…", None,
                             enabled=False, visible=busy),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("مشاهدهٔ لاگ‌ها",
                             lambda: os.startfile(LOG_DIR)),
            pystray.MenuItem("پوشهٔ داده‌ها",
                             lambda: os.startfile(DATA_DIR)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("خروج از آیکن (سرور روشن می‌ماند)",
                             lambda: self.icon.stop()),
        )

    # ---- actions ---------------------------------------------------
    @staticmethod
    def _copy(text: str) -> None:
        try:
            subprocess.run(["clip"], input=text, text=True, timeout=10,
                           creationflags=CREATE_NO_WINDOW)
        except Exception:
            pass

    def _control(self, verb: str) -> None:
        def work() -> None:
            if sc(verb, SERVICE) != 0:
                self.icon.notify(
                    "عملیات سرور ناموفق بود؛ لاگ‌ها را بررسی کنید.",
                    "محاسب پرو")
            self._refresh()
        threading.Thread(target=work, daemon=True).start()

    def _restart(self) -> None:
        def work() -> None:
            sc("stop", SERVICE)
            for _ in range(30):
                if service_state() == STOPPED:
                    break
                time.sleep(1)
            sc("start", SERVICE)
            self._refresh()
        threading.Thread(target=work, daemon=True).start()

    # ---- state polling ---------------------------------------------
    def _refresh(self) -> None:
        new_state = service_state()
        if new_state != self.state:
            self.state = new_state
            self.icon.icon = make_icon(new_state)
        self.icon.title = (
            f"محاسب پرو — {STATE_TEXT.get(self.state, '?')} "
            f"(پورت {self.port})")
        self.icon.menu = self._menu()
        self.icon.update_menu()

    def _poll(self) -> None:
        while True:
            time.sleep(3)
            try:
                self._refresh()
            except Exception:
                pass  # the tray must never die over a status read

    def run(self) -> None:
        threading.Thread(target=self._poll, daemon=True).start()
        self.icon.run()


def main() -> int:
    # Single instance per session: a second launch just exits.
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, "MohasebProTray")
    if ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        return 0
    Tray().run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
