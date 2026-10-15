# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"d:\Developer\Sekar Construction\careers.html")
text = p.read_text(encoding="utf-8")

# Mojibake sequences commonly produced when UTF-8 is decoded as Windows-1252
replacements = {
    "\u00e2\u0080\u0094": "\u2014",  # — as mojibake chars sometimes stored
    "\u00e2\u0080\u0093": "\u2013",
    "\u00e2\u0080\u00a6": "\u2026",
    "r\u00c3\u00a9sum\u00c3\u00a9": "resume",
    "R\u00c3\u00a9sum\u00c3\u00a9": "Resume",
}

# Direct replacements for the literal mojibake currently in the file
# â€” (em dash mojibake) and rÃ©sumÃ©
import re
text2 = text
text2 = text2.replace("â€”", "\u2014")
text2 = text2.replace("â€“", "\u2013")
text2 = text2.replace("â€¦", "\u2026")
text2 = text2.replace("rÃ©sumÃ©", "resume")
text2 = text2.replace("RÃ©sumÃ©", "Resume")
# Normalize any remaining accented resume spelling to ASCII
text2 = text2.replace("r\u00e9sum\u00e9", "resume").replace("R\u00e9sum\u00e9", "Resume")

p.write_text(text2, encoding="utf-8", newline="\n")
bad = ("Ã" in text2) or ("â€" in text2)
print("done bad=", bad)
if bad:
    for i, line in enumerate(text2.splitlines(), 1):
        if "Ã" in line or "â€" in line:
            print(i, line[:120])
