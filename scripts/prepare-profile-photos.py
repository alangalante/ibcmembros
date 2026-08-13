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
        oriented = ImageOps.exif_transpose(original).convert("RGBA")
    # Preserva os recortes transparentes sobre um fundo neutro e acrescenta
    # margem para que cabelos e topo da cabeça nunca encostem no avatar.
    padding = round(max(oriented.width, oriented.height) * .12)
    image = Image.new("RGB", (oriented.width + padding * 2, oriented.height + padding * 2), "#f8fafc")
    image.paste(oriented.convert("RGB"), (padding, padding), oriented.getchannel("A"))
    rgb = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2GRAY)
    scale = min(1.0, 1400 / max(rgb.shape[1], rgb.shape[0]))
    sample = cv2.resize(rgb, None, fx=scale, fy=scale) if scale < 1 else rgb
    detected = detector.detectMultiScale(sample, scaleFactor=1.08, minNeighbors=5, minSize=(35, 35))
    faces = sorted(detected, key=lambda face: face[2] * face[3], reverse=True)
    if faces:
        largest_area = faces[0][2] * faces[0][3]
        faces = [face for face in faces if face[2] * face[3] >= largest_area * .25]
    if not faces:
        crop = ImageOps.contain(image, (400, 400), method=Image.Resampling.LANCZOS)
        framed = Image.new("RGB", (400, 400), "#f8fafc")
        framed.paste(crop, ((400 - crop.width) // 2, (400 - crop.height) // 2))
        crop = framed
        destination = output / f"{slug(member['username'])}.webp"
        crop.save(destination, "WEBP", quality=84, method=6)
        manifest.append({"name": member["name"], "username": member["username"], "source": str(path), "file": str(destination)})
        continue
    # A associação já foi validada por data e nome. Rostos pequenos adicionais
    # podem ser falsos positivos em roupas/transparências; recorta pelo principal.
    faces = faces[:1]
    x, y, w, h = [int(value / scale) for value in faces[0]]
    x += padding; y += padding
    side = min(image.width, image.height, max(w, h) * 5.4)
    center_x = x + w / 2
    left = max(0, min(image.width - side, center_x - side / 2))
    top = max(0, min(image.height - side, y - h * 1.15))
    crop = image.crop((round(left), round(top), round(left + side), round(top + side))).resize((400, 400), Image.Resampling.LANCZOS)
    destination = output / f"{slug(member['username'])}.webp"
    crop.save(destination, "WEBP", quality=84, method=6)
    manifest.append({"name": member["name"], "username": member["username"], "source": str(path), "file": str(destination)})
Path("migration-output/profile-photo-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(f"{len(manifest)} fotos de perfil preparadas")
