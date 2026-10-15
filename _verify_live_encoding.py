# -*- coding: utf-8 -*-
import subprocess
import tempfile
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
urls = [
    "https://www.sekarconstructions.com/",
    "https://www.sekarconstructions.com/about",
    "https://www.sekarconstructions.com/leadership",
    "https://www.sekarconstructions.com/contact",
    "https://www.sekarconstructions.com/gallery",
    "https://www.sekarconstructions.com/portfolio",
    "https://www.sekarconstructions.com/infrastructure",
    "https://www.sekarconstructions.com/ongoing-projects",
]
prefix = bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC])
dot = bytes([0xC3, 0x82, 0xC2, 0xB7])
em = bytes([0xE2, 0x80, 0x94])

for u in urls:
    with tempfile.NamedTemporaryFile(delete=False) as f:
        tmp = f.name
    subprocess.run(["curl.exe", "-sL", "-A", UA, "-o", tmp, u], check=True)
    b = Path(tmp).read_bytes()
    Path(tmp).unlink(missing_ok=True)
    bad = prefix in b or dot in b
    i = b.find(b'name="description"')
    snip = b[i : i + 110] if i >= 0 else b[200:300]
    print(u, "len=", len(b), "moj=", bad, "em=", b.count(em))
    print(" ", snip)
