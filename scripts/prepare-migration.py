#!/usr/bin/env python3
"""Gera uma prévia determinística da migração. Não acessa Firebase nem produção."""

from __future__ import annotations

import argparse, csv, hashlib, json, re, unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook
from PIL import Image

PARTICLES = {"da", "das", "de", "do", "dos", "e"}
ADMIN_NAMES = {"Alan Carvalho Galante", "Tarcísio Nunes Cardoso", "Ackley de Almeida Fontes", "Ruiter de Campos Muniz"}
SPECIAL_LEADERS = {
    "Grupo de Adolescentes": ["Ariana Pires de Almeida Medeiros", "Luana Cristine dos Santos Lima Ayres", "Lucas Medeiros Pereira Nascimento", "Rodrigo de Souza Ayres"],
    "Grupo de Jovens": ["Rafael Brasil de Aguiar", "Aline Alves Ramos Brasil"],
}

def ascii_key(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value or "") if unicodedata.category(c) != "Mn").lower()

def pretty_name(value: str) -> str:
    words = re.sub(r"\s+", " ", value.strip()).lower().split()
    return " ".join(word if index and word in PARTICLES else word[:1].upper() + word[1:] for index, word in enumerate(words))

def username_base(name: str) -> str:
    words = [re.sub(r"[^a-z0-9]", "", ascii_key(word)) for word in name.split()]
    words = [word for word in words if word]
    if len(words) == 1: return f"{words[0]}.{words[0]}"
    return f"{words[0]}{words[1][0]}.{words[-1]}"

def initial_password(name: str) -> str:
    """Regra única e comunicável: último sobrenome normalizado + 123."""
    return f"{ascii_key(name.split()[-1])}123"

def normalize_phone(value: object) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("55") and len(digits) in (12, 13): digits = digits[2:]
    return digits if len(digits) in (10, 11) else ""

def iso_date(value: object) -> str | None:
    if isinstance(value, (datetime, date)): return value.strftime("%Y-%m-%d")
    if not value: return None
    text = str(value).strip()
    for pattern in ("%d/%m/%Y", "%Y-%m-%d"):
        try: return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError: pass
    return None

def group_info(raw: str) -> tuple[str | None, str | None]:
    raw = str(raw or "").strip()
    if not raw or ascii_key(raw) == "nenhum": return None, None
    numbered = re.match(r"^(\d+)\s*-\s*(.+)$", raw)
    if numbered: return f"Grupo {int(numbered.group(1))}", pretty_name(numbered.group(2))
    if ascii_key(raw) == "adolescentes": return "Grupo de Adolescentes", None
    if ascii_key(raw) == "jovens": return "Grupo de Jovens", None
    return pretty_name(raw), None

def photo_tokens(path: Path) -> set[str]:
    stem = re.sub(r"^\d{1,2}-\d{1,2}\s*", "", path.stem)
    return {token for token in re.findall(r"[a-z]{3,}", ascii_key(stem)) if token not in PARTICLES}

def likely_single(path: Path) -> bool:
    name = ascii_key(path.stem)
    return not re.search(r"\b(e|com)\b|\+|famil|casal|grupo", name)

def run(source: Path, photos: Path, output: Path) -> None:
    sheet = load_workbook(source, data_only=True, read_only=True).active
    rows = []
    for row_number, row in enumerate(sheet.iter_rows(min_row=8, values_only=True), 8):
        name, nickname, birth, phone1, phone2, raw_group, status = row[1:8]
        if ascii_key(str(status or "")).upper() != "MEMBRO": continue
        rows.append({"sourceRow": row_number, "name": pretty_name(str(name)), "nickname": pretty_name(str(nickname)) if nickname else "", "birthDate": iso_date(birth), "phoneE164": normalize_phone(phone1), "secondaryPhone": normalize_phone(phone2), "rawGroup": str(raw_group or "")})

    used = Counter(); members = []
    for row in rows:
        base = username_base(row["name"]); used[base] += 1
        username = base if used[base] == 1 else f"{base}{used[base]}"
        group, partial_leader = group_info(row.pop("rawGroup"))
        members.append({**row, "username": username, "initialPassword": initial_password(row["name"]), "mustChangePassword": True, "group": group, "partialLeader": partial_leader, "role": "admin" if row["name"] in ADMIN_NAMES else "common", "photo": None})

    by_name = {ascii_key(member["name"]): member for member in members}
    group_leaders: dict[str, list[str]] = defaultdict(list)
    errors = []
    for member in members:
        if member["group"] and member["partialLeader"]:
            query = set(ascii_key(member["partialLeader"]).split())
            matches = [candidate for candidate in members if query <= set(ascii_key(candidate["name"]).split())]
            if len(matches) == 1: group_leaders[member["group"]].append(matches[0]["name"])
            elif len(matches) != 0: errors.append(f"Líder ambíguo: {member['partialLeader']}")
    for group, leaders in SPECIAL_LEADERS.items(): group_leaders[group].extend(leaders)
    for leaders in group_leaders.values():
        for name in leaders:
            if ascii_key(name) not in by_name: errors.append(f"Líder não encontrado: {name}")
            elif by_name[ascii_key(name)]["role"] != "admin": by_name[ascii_key(name)]["role"] = "leader"

    candidates: dict[str, list[dict]] = defaultdict(list)
    for path in photos.rglob("*"):
        if not path.is_file() or path.name.startswith(".") or not likely_single(path): continue
        tokens = photo_tokens(path)
        for member in members:
            name_tokens = set(ascii_key(member["name"]).split()) - PARTICLES
            overlap = tokens & name_tokens
            birth = member["birthDate"]
            dated = re.match(r"^(\d{1,2})-(\d{1,2})", path.stem)
            date_match = bool(birth and dated and int(dated.group(1)) == int(birth[8:10]) and int(dated.group(2)) == int(birth[5:7]))
            if (date_match and overlap) or len(overlap) >= 2:
                try:
                    with Image.open(path) as image: width, height = image.size
                except Exception: continue
                score = (3 if date_match else 0) + len(overlap) * 2 + min(width * height / 1_000_000, 5)
                candidates[member["name"]].append({"path": str(path), "score": round(score, 2), "width": width, "height": height})
    for member in members:
        options = sorted(candidates[member["name"]], key=lambda item: (-item["score"], -(item["width"] * item["height"]), item["path"]))
        if options: member["photo"] = options[0]["path"]

    groups = []
    for name in sorted({m["group"] for m in members if m["group"]}, key=lambda value: (not value.startswith("Grupo ") or not value[6:].isdigit(), int(value[6:]) if value[6:].isdigit() else value)):
        participants = [m["username"] for m in members if m["group"] == name]
        leaders = list(dict.fromkeys(group_leaders[name]))
        groups.append({"name": name, "participantUsernames": participants, "leaderNames": leaders})

    usernames = [m["username"] for m in members]
    if len(usernames) != len(set(usernames)): errors.append("Há nomes de usuário duplicados")
    output.mkdir(parents=True, exist_ok=True)
    (output / "migration-preview.json").write_text(json.dumps({"members": members, "groups": groups}, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output / "members-preview.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fields = ["sourceRow", "name", "username", "initialPassword", "birthDate", "phoneE164", "secondaryPhone", "group", "role", "photo"]
        writer = csv.DictWriter(handle, fields); writer.writeheader(); writer.writerows(({key: m.get(key) or "" for key in fields} for m in members))
    report = {"members": len(members), "groups": len(groups), "admins": sum(m["role"] == "admin" for m in members), "leaders": sum(m["role"] == "leader" for m in members), "withoutBirthDate": sum(not m["birthDate"] for m in members), "withoutPhone": sum(not m["phoneE164"] for m in members), "initialPasswordRule": "ultimo_sobrenome_sem_acento_em_minusculas+123", "withSelectedPhoto": sum(bool(m["photo"]) for m in members), "photoSelectionNeedsHumanReview": True, "errors": errors}
    (output / "validation-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors: raise SystemExit(2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("data/MEMBROS - ALAN.xlsx"))
    parser.add_argument("--photos", type=Path, default=Path("data/Fotos"))
    parser.add_argument("--output", type=Path, default=Path("migration-output"))
    args = parser.parse_args(); run(args.source, args.photos, args.output)
