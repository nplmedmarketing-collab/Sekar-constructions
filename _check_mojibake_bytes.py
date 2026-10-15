# -*- coding: utf-8 -*-
from pathlib import Path

for name in ["about.html", "index.html", "leadership.html", "contact.html"]:
    raw = Path(r"d:\Developer\Sekar Construction") / name
    b = raw.read_bytes()
    print("===", name, "len", len(b))
    print("  real emdash E2 80 94:", b.count(bytes([0xE2, 0x80, 0x94])))
    print("  real endash E2 80 93:", b.count(bytes([0xE2, 0x80, 0x93])))
    print("  mojibake â€ C3 A2 E2 82 AC:", b.count(bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC])))
    # find description meta
    key = b'name="description"'
    i = b.find(key)
    if i >= 0:
        print("  desc bytes:", b[i : i + 100])
