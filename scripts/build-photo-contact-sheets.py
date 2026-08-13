#!/usr/bin/env python3
import json, math, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

output = Path("migration-output/photo-contact-sheets")
output.mkdir(parents=True, exist_ok=True)
preview = json.loads(Path("migration-output/migration-preview.json").read_text())
members = [member for member in preview["members"] if member.get("photo")]
previous_manifest = Path("migration-output/profile-photo-manifest.json")
if "--new-only" in __import__("sys").argv and previous_manifest.exists():
    previous = {item["username"] for item in json.loads(previous_manifest.read_text())}
    members = [member for member in members if member["username"] not in previous]
    output = Path("migration-output/photo-contact-sheets-new")
    output.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default(size=14)
cols, rows, cell_w, cell_h = 4, 5, 240, 290
for page in range(math.ceil(len(members) / (cols * rows))):
    canvas = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(canvas)
    for index, member in enumerate(members[page * cols * rows:(page + 1) * cols * rows]):
        x, y = (index % cols) * cell_w, (index // cols) * cell_h
        try:
            with Image.open(member["photo"]) as source:
                thumb = ImageOps.fit(source.convert("RGB"), (220, 220), method=Image.Resampling.LANCZOS)
            canvas.paste(thumb, (x + 10, y + 8))
        except Exception:
            draw.rectangle((x + 10, y + 8, x + 230, y + 228), fill="#fee2e2")
        name = "\n".join(textwrap.wrap(member["name"], width=28)[:2])
        draw.text((x + 10, y + 235), name, font=font, fill="#111827")
        draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline="#cbd5e1")
    canvas.save(output / f"page-{page + 1:02d}.jpg", quality=88, optimize=True)
print(f"{len(members)} fotos em {math.ceil(len(members)/(cols*rows))} páginas")
