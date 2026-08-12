#!/usr/bin/env python3
import json, re, unicodedata
from pathlib import Path
import cv2
from PIL import Image, ImageOps

source = json.loads(Path("migration-output/migration-preview.json").read_text())
output = Path("migration-output/profile-photos")
output.mkdir(parents=True, exist_ok=True)
detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
manifest = []

def slug(value):
    value = "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")

for member in source["members"]:
    if not member.get("photo"): continue
    path = Path(member["photo"])
    with Image.open(path) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
    rgb = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2GRAY)
    scale = min(1.0, 1400 / max(rgb.shape[1], rgb.shape[0]))
    sample = cv2.resize(rgb, None, fx=scale, fy=scale) if scale < 1 else rgb
    faces = detector.detectMultiScale(sample, scaleFactor=1.08, minNeighbors=5, minSize=(35, 35))
    if len(faces) != 1: continue
    x, y, w, h = [int(value / scale) for value in faces[0]]
    side = min(image.width, image.height, max(w, h) * 4)
    center_x, center_y = x + w / 2, y + h * 1.25
    left = max(0, min(image.width - side, center_x - side / 2))
    top = max(0, min(image.height - side, center_y - side * .38))
    crop = image.crop((round(left), round(top), round(left + side), round(top + side))).resize((400, 400), Image.Resampling.LANCZOS)
    destination = output / f"{slug(member['username'])}.webp"
    crop.save(destination, "WEBP", quality=84, method=6)
    manifest.append({"name": member["name"], "username": member["username"], "source": str(path), "file": str(destination)})
Path("migration-output/profile-photo-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(f"{len(manifest)} fotos de perfil preparadas")
