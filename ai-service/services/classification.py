"""
AI-SERVICE-HARITA: services/classification.py
- Belge kategori kurallarini ve kategori tespit fonksiyonunu icerir.
- Metin normalizasyonu (Turkce karakter sadelestirme) saglar.
"""

from __future__ import annotations


CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Cumhurbaskanligi", ["cumhurbaskanligi kararname", "cumhurbaskanligi genelge", "cumhurbaskanligi karari"]),
    ("Bankacilik", ["merkez bankasi", "bddk", "bankacilik", "doviz kuru"]),
    ("SermayePiyasasi", ["sermaye piyasasi kurulu", "spk", "borsa istanbul", "yatirim fonu"]),
    ("FinansVergi", ["hazine ve maliye", "gelir vergisi", "kurumlar vergisi", "kdv", "muhasebat", "butce", "stopaj"]),
    ("DisTicaret", ["disisleri bakanligi", "ticaret bakanligi", "ihracat", "ithalat", "gumruk", "lisansli depo"]),
    ("AkademikIlan", ["universite", "ogretim uyesi", "docent", "profesor", "yuksekogretim", "fakulte"]),
    ("InsanKaynaklari", ["calisma ve sosyal guvenlik", "sosyal guvenlik kurumu", "is kanunu", "asgari ucret", "personel"]),
    ("Saglik", ["saglik bakanligi", "ilac", "tibbi cihaz", "eczane", "tabip", "turk gida kodeksi", "gida"]),
    ("CevreEnerji", ["cevre", "sehircilik", "enerji", "elektrik", "dogalgaz", "epdk", "iklim", "orman", "tarim ve orman"]),
    ("IhaleIlan", ["artirma", "eksiltme", "ihale", "ihale ilanlari", "belediye baskanligi", "il ozel idaresi"]),
    ("YargiKarari", ["anayasa mahkemesi", "yargitay", "danistay", "mahkeme karari", "bireysel basvuru"]),
    ("YargiIlan", ["yargi ilanlari", "savcilik", "icra mudurlugu", "iflas dairesi"]),
]


def normalize_tr(text: str) -> str:
    tr_map = str.maketrans(
        {
            "\u00e7": "c",
            "\u00c7": "c",
            "\u011f": "g",
            "\u011e": "g",
            "\u0131": "i",
            "\u0130": "i",
            "\u00f6": "o",
            "\u00d6": "o",
            "\u015f": "s",
            "\u015e": "s",
            "\u00fc": "u",
            "\u00dc": "u",
            "\u00e2": "a",
            "\u00c2": "a",
            "\u00ee": "i",
            "\u00ce": "i",
            "\u00fb": "u",
            "\u00db": "u",
        }
    )
    return (text or "").translate(tr_map)


def detect_category(title: str, raw_text: str, source_url: str) -> str:
    text = normalize_tr(f"{title}\n{raw_text}").lower()
    source = (source_url or "").lower()

    if "/ilanlar/eskiilanlar/" in source:
        if "yargi ilan" in text:
            return "YargiIlan"
        if "ihale" in text or "artirma" in text or "eksiltme" in text:
            return "IhaleIlan"

    best_cat = "Diger"
    best_score = 0.0
    for cat, keywords in CATEGORY_RULES:
        score = sum(1 + len(k.split()) * 0.5 for k in keywords if k in text)
        if score > best_score:
            best_score = score
            best_cat = cat
    return best_cat
