# -*- coding: utf-8 -*-
"""Inventory unique mojibake byte tails after â€ (C3 A2 E2 82 AC)."""
from pathlib import Path
from collections import Counter

ROOT = Path(r"d:\Developer\Sekar Construction")
SKIP = {"api", "deploy-live-api", "deploy-live-api-node16", "_nm_build", "node_modules", ".git"}
prefix = bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC])
other_prefixes = [
    bytes([0xC3, 0x82]),  # Â
    bytes([0xC3, 0x83]),  # Ã
    bytes([0xC3, 0xA2, 0xE2, 0x80, 0xA0]),  # â†
]

counts = Counter()
samples = {}

for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in {".html", ".js", ".css"}:
        continue
    if any(p in SKIP for p in path.parts) or path.name.startswith("_"):
        continue
    b = path.read_bytes()
    start = 0
    while True:
        i = b.find(prefix, start)
        if i < 0:
            break
        # take next 1-3 utf-8 chars worth of bytes (up to 9 bytes)
        tail = b[i : i + 12]
        # classify by first 6-9 bytes of sequence
        key = tail[:9]
        counts[key] += 1
        samples.setdefault(key, (path.name, b[max(0, i - 20) : i + 12]))
        start = i + 1

print("â€* sequences:")
for k, n in counts.most_common(30):
    name, samp = samples[k]
    print(n, k.hex(), "ex", name, samp)

# Also Â and Ã starters
for label, pfx in [("Â", bytes([0xC3, 0x82])), ("Ã", bytes([0xC3, 0x83])), ("â†", bytes([0xC3, 0xA2, 0xE2, 0x80, 0xA0]))]:
    c = Counter()
    for path in ROOT.glob("*.html"):
        b = path.read_bytes()
        start = 0
        while True:
            i = b.find(pfx, start)
            if i < 0:
                break
            c[b[i : i + 6]] += 1
            start = i + 1
    if c:
        print("===", label)
        for k, n in c.most_common(15):
            print(n, k.hex(), k)
