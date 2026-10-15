# -*- coding: utf-8 -*-
"""Fix UTF-8-as-CP1252 mojibake in public site files (byte-accurate)."""
from pathlib import Path

ROOT = Path(r"d:\Developer\Sekar Construction")
SKIP_DIRS = {
    "api",
    "deploy-live-api",
    "deploy-live-api-node16",
    "_nm_build",
    "node_modules",
    ".git",
}

# Longer sequences first
BYTE_FIXES = [
    # • (U+2022) password dots etc. â€¢
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC2, 0xA2]), "\u2022".encode("utf-8")),
    # — em dash â€ (third char U+201D)
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x9D]), "\u2014".encode("utf-8")),
    # – en dash â€œ (third char U+201C)
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x9C]), "\u2013".encode("utf-8")),
    # ’ right single â€™
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x84, 0xA2]), "\u2019".encode("utf-8")),
    # … ellipsis â€¦
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC2, 0xA6]), "\u2026".encode("utf-8")),
    # “ left double â€œ (â + € + œ)
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC5, 0x93]), "\u201c".encode("utf-8")),
    # ” right double â€ + U+009D
    (bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC2, 0x9D]), "\u201d".encode("utf-8")),
    # → arrow â†’
    (bytes([0xC3, 0xA2, 0xE2, 0x80, 0xA0, 0xE2, 0x80, 0x99]), "\u2192".encode("utf-8")),
    # · middle dot Â·
    (bytes([0xC3, 0x82, 0xC2, 0xB7]), "\u00b7".encode("utf-8")),
    # × as Ã— (proper double-encoding)
    (bytes([0xC3, 0x83, 0xC2, 0x97]), "\u00d7".encode("utf-8")),
    # × as Ã— where middle became real emdash (observed)
    (bytes([0xC3, 0x83, 0xE2, 0x80, 0x94]), "\u00d7".encode("utf-8")),
    # é Ã©
    (bytes([0xC3, 0x83, 0xC2, 0xA9]), "\u00e9".encode("utf-8")),
    # Â· already; Â + NBSP / space
    (bytes([0xC3, 0x82, 0xC2, 0xA0]), "\u00a0".encode("utf-8")),
    (bytes([0xC3, 0x82, 0x20]), b" "),
    # replacement char
    (bytes([0xEF, 0xBF, 0xBD]), b""),
]


def fix_bytes(data: bytes) -> bytes:
    out = data
    for bad, good in BYTE_FIXES:
        out = out.replace(bad, good)
    return out


def main():
    changed = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".html", ".js", ".css"}:
            continue
        if any(p in SKIP_DIRS for p in path.parts):
            continue
        if path.name.startswith("_"):
            continue

        raw = path.read_bytes()
        fixed = fix_bytes(raw)
        if fixed == raw:
            continue
        text = fixed.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
        path.write_text(text, encoding="utf-8", newline="\n")
        changed.append(path.relative_to(ROOT).as_posix())

    print("changed", len(changed))
    for c in changed:
        print(c)

    left_files = []
    prefix = bytes([0xC3, 0xA2, 0xE2, 0x82, 0xAC])
    for path in list(ROOT.glob("*.html")) + list((ROOT / "contact").glob("*.html")) + list((ROOT / "admin").glob("*.html")):
        b = path.read_bytes()
        if prefix in b or bytes([0xC3, 0x82, 0xC2, 0xB7]) in b or bytes([0xC3, 0x83, 0xC2, 0x97]) in b:
            left_files.append(path.as_posix())
    print("remaining", left_files)


if __name__ == "__main__":
    main()
