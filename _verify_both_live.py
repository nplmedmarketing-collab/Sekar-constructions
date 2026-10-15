# -*- coding: utf-8 -*-
from pathlib import Path
import os

tmp = os.environ.get("TEMP", ".")
idx = Path(tmp, "live-index.html").read_text(encoding="utf-8", errors="replace")
css = Path(tmp, "live-styles.css").read_text(encoding="utf-8", errors="replace")
js = Path(tmp, "live-script.js").read_text(encoding="utf-8", errors="replace")
b = Path(tmp, "live-index.html").read_bytes()

print("index styles v206:", "styles.css?v=206" in idx)
print("index script v178:", "script.site.js?v=178" in idx)
print("css sticky mobile off:", "Mobile: sticky footer reveal clips" in css)
print("css spacer 0:", "--curtain-reveal-spacer: 0px" in css)
print("js mobile spacer 0:", "max-width: 900px" in js and "0px" in js)
print("index mojibake:", bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC]) in b)
print("index real emdash:", bytes([0xE2, 0x80, 0x94]) in b)
