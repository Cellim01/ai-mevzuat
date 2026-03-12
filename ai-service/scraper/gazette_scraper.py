"""
Resmi Gazete Scraper - v7
- Robust HTML decode and cleanup
- Issue number fallback (index + first available detail page)
- Merge missing index-only items into document list
"""

from __future__ import annotations

import asyncio
import html as html_lib
import re
from datetime import date
from pathlib import Path

import httpx
from bs4 import BeautifulSoup, Comment
from loguru import logger
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from utils.config import settings

try:
    from lxml import html as lxml_html
except Exception:
    lxml_html = None


BASE_URL = settings.gazette_base_url.rstrip("/")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
}

# IMPORTANT: category names must match backend DocumentCategory enum values.
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
    ("YargiCeza", ["anayasa mahkemesi", "yargitay", "danistay", "mahkeme", "savcilik", "icra mudurlugu", "yargi ilanlari"]),
]

DOC_TYPE_HINTS = [
    "yonetmelik", "teblig", "karar", "kanun", "kararname",
    "genelge", "yonerge", "ilan", "duyuru",
]

SKIP_LINE_RE = re.compile(
    r"^(resm[iî]\s+gazete|say[ıi]\s*:|\d+\s+\w+\s+\d{4}|"
    r"pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)$",
    re.IGNORECASE,
)

INSTITUTION_RE = re.compile(
    r"(bakanligindan|mudurlugunden|baskanligindan|kurulundan|kurumundan|"
    r"idaresinden|universitesinden|mahkemesinden|savciligindan|"
    r"ndan:|nden:|dan:|den:)\s*$",
    re.IGNORECASE,
)

TAG_RE = re.compile(r"<[a-zA-Z!/][^>]{0,300}>")
ISSUE_RE_LIST = [
    re.compile(r"Say[ıi]\s*[:\-]\s*(\d{5,6})", re.IGNORECASE),
    re.compile(r"(\d{5,6})\s+Say[ıi]l[ıi]", re.IGNORECASE),
    re.compile(r"Resm[iî]\s+Gazete.*?(\d{5,6})", re.IGNORECASE | re.DOTALL),
]

NOISE_SNIPPETS = [
    "xmlns:", "mso-", "tab-stops:", "font-family:", "meta http-equiv",
    "worddocument", "filelist.xml", "style='", "style=\"", "class=", "o:p",
]

INDEX_NAV_SKIP = {
    "arama", "tum kategoriler", "zaman araligi", "son mukerrer", "arsiv", "onceki sayi",
    "resmi gazetenin kurumsal mobil uygulamasi",
}

INDEX_SECTION_SKIP = {
    "yurutme ve idare bolumu",
    "yargi bolumu",
    "ilan bolumu",
    "yonetmelikler",
    "tebligler",
    "yargitay kararlari",
    "yargi ilanlari",
    "artirma eksiltme ve ihale ilanlari",
    "cesitli ilanlar",
}


def _normalize_tr(text: str) -> str:
    repl = str.maketrans(
        {
            "ç": "c", "Ç": "c",
            "ğ": "g", "Ğ": "g",
            "ı": "i", "İ": "i",
            "ö": "o", "Ö": "o",
            "ş": "s", "Ş": "s",
            "ü": "u", "Ü": "u",
            "â": "a", "Â": "a",
            "î": "i", "Î": "i",
            "û": "u", "Û": "u",
        }
    )
    return text.translate(repl)


def _title_key(title: str) -> str:
    t = _normalize_tr(title).lower()
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _decode_response(resp: httpx.Response) -> str:
    for enc in ("windows-1254", "iso-8859-9", "utf-8", "latin-1"):
        try:
            text = resp.content.decode(enc)
            probe = _normalize_tr(text).lower()
            if any(k in probe for k in ("resmi", "gazete", "sayi", "bakanligi")):
                return text
        except (UnicodeDecodeError, LookupError):
            continue
    return resp.text


def _extract_issue_number_from_text(text: str) -> int | None:
    for regex in ISSUE_RE_LIST:
        mobj = regex.search(text)
        if not mobj:
            continue
        value = int(mobj.group(1))
        if 20000 <= value <= 40000:
            return value
    return None


def _detect_category(text: str) -> str:
    lower = _normalize_tr(text).lower()
    best_cat, best_score = "Diger", 0.0
    for cat, keywords in CATEGORY_RULES:
        score = sum(1 + len(k.split()) * 0.5 for k in keywords if k in lower)
        if score > best_score:
            best_score, best_cat = score, cat
    return best_cat


def _is_heading_line(line: str) -> bool:
    if len(line) < 8:
        return False
    letters = re.sub(r"[^A-Za-z]", "", _normalize_tr(line))
    if len(letters) < 6:
        return False
    upp = sum(1 for ch in letters if ch.isupper())
    return upp / max(1, len(letters)) >= 0.7


def _clean_text_blob(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r", "\n")
    for _ in range(2):
        decoded = html_lib.unescape(text)
        if decoded == text:
            break
        text = decoded

    out_lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        lower = line.lower()
        if any(s in lower for s in NOISE_SNIPPETS):
            continue

        if TAG_RE.search(line):
            if line.count("<") >= 2 or line.count(">") >= 2:
                continue
            line = TAG_RE.sub(" ", line).strip()
            if not line:
                continue

        line = re.sub(r"[ \t]{2,}", " ", line).strip()
        if len(line) < 2:
            continue
        out_lines.append(line)

    cleaned = "\n".join(out_lines)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def _looks_dirty(text: str) -> bool:
    if not text:
        return True
    lower = text.lower()
    if sum(1 for s in NOISE_SNIPPETS if s in lower) >= 2:
        return True
    if TAG_RE.search(text):
        return True
    return False


def _extract_title_and_doctype(soup: BeautifulSoup) -> tuple[str, str]:
    s = BeautifulSoup(str(soup), "lxml")

    for tag in s(["script", "style", "nav", "header", "footer", "xml", "meta", "link"]):
        tag.decompose()
    for c in s.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()

    doc_type = ""
    for span in s.find_all("span", style=True):
        style = (span.get("style") or "").lower()
        text = span.get_text(" ", strip=True)
        if "navy" in style and text and len(text) <= 45:
            doc_type = text
            break

    if not doc_type:
        for b in s.find_all(["b", "strong"]):
            txt = b.get_text(" ", strip=True)
            if len(txt) <= 45 and any(k in _normalize_tr(txt).lower() for k in DOC_TYPE_HINTS):
                doc_type = txt
                break

    institution = ""
    institution_tag = None

    for p in s.find_all("p", class_=True):
        cls = p.get("class", [])
        cls_str = " ".join(cls) if isinstance(cls, list) else str(cls)
        text = re.sub(r"\s+", " ", p.get_text(" ", strip=True)).strip()
        ntext = _normalize_tr(text).lower()

        if ("balk" in cls_str.lower()) and INSTITUTION_RE.search(ntext):
            institution = text.rstrip(":")
            institution_tag = p
            break

    if institution_tag is not None and institution:
        prev_p = institution_tag.find_previous_sibling("p")
        if prev_p:
            prev_text = re.sub(r"\s+", " ", prev_p.get_text(" ", strip=True)).strip()
            if prev_text and len(prev_text) <= 40:
                ninst = _normalize_tr(institution).lower()
                if ninst.startswith(("universitesinden", "bakanligindan", "mudurlugunden", "baskanligindan")):
                    institution = f"{prev_text} {institution}"

    heading_parts: list[str] = []
    if institution_tag is not None:
        for sib in institution_tag.find_next_siblings("p"):
            cls = sib.get("class", [])
            cls_str = " ".join(cls) if isinstance(cls, list) else str(cls)
            txt = re.sub(r"\s+", " ", sib.get_text(" ", strip=True)).strip()
            if not txt:
                continue

            if "ortabalk" in cls_str.lower():
                heading_parts.append(txt)
                continue

            if heading_parts:
                break

    if not heading_parts:
        lines = [ln.strip() for ln in s.get_text("\n").splitlines() if ln.strip()]
        lines = [ln for ln in lines if not SKIP_LINE_RE.match(_normalize_tr(ln).lower())]

        if not institution:
            for i, line in enumerate(lines[:160]):
                if INSTITUTION_RE.search(_normalize_tr(line).lower()):
                    institution = line.rstrip(":")
                    if i > 0 and len(lines[i - 1]) <= 40:
                        ninst = _normalize_tr(institution).lower()
                        if ninst.startswith(("universitesinden", "bakanligindan", "mudurlugunden", "baskanligindan")):
                            institution = f"{lines[i - 1]} {institution}"
                    break

        for i, line in enumerate(lines[:160]):
            if _is_heading_line(line):
                heading_parts.append(line)
                for nxt in lines[i + 1:i + 8]:
                    if _is_heading_line(nxt):
                        heading_parts.append(nxt)
                    elif heading_parts:
                        break
                break

    title_main = " ".join(heading_parts).strip()

    if not title_main and s.title and s.title.get_text(strip=True):
        title_main = s.title.get_text(" ", strip=True)
        title_main = re.sub(r"\s*-\s*Resm[iî]\s+Gazete.*$", "", title_main, flags=re.IGNORECASE).strip()

    if institution and title_main:
        title = f"{institution}: {title_main}"
    elif title_main:
        title = title_main
    elif institution:
        title = institution
    else:
        title = "Basliksiz Belge"

    title = re.sub(r"\s{2,}", " ", title).strip()
    return title[:500], doc_type


class GazetteScraper:
    def __init__(self):
        self.download_dir = Path(settings.gazette_download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)

    async def scrape(self, target_date: date) -> dict | None:
        logger.info(f"== Scrape basliyor -> {target_date} ==")

        y = target_date.strftime("%Y")
        m = target_date.strftime("%m")
        ds = target_date.strftime("%Y%m%d")

        index_data = await self._get_index_snapshot(y, m, ds)
        issue_number = index_data["issue_number"]

        doc_urls = await self._probe_document_urls(ds, y, m)
        if not doc_urls and not index_data["entries"]:
            logger.error(f"Hic belge bulunamadi: {target_date}")
            return None

        if issue_number is None:
            issue_number = await self._get_issue_number(y, m, ds, doc_urls)

        logger.info(f"Sayi: {issue_number} | {len(doc_urls)} belge bulundu")

        sem = asyncio.Semaphore(5)
        tasks = [self._fetch_document(url, i + 1, sem) for i, url in enumerate(doc_urls)]
        docs = await asyncio.gather(*tasks)
        documents = [d for d in docs if d is not None]

        issue_pdf_url = f"{BASE_URL}/eskiler/{y}/{m}/{ds}.pdf"
        added_from_index = self._merge_index_entries(
            documents,
            index_data["entries"],
            index_data["url"],
            issue_pdf_url,
        )

        if issue_number is None and documents:
            issue_number = _extract_issue_number_from_text(documents[0].get("raw_text", ""))

        logger.success(f"== Tamamlandi -> {len(documents)}/{len(doc_urls)} belge ==")
        if added_from_index > 0:
            logger.info(f"Index'ten ekstra {added_from_index} kayit eklendi")

        for doc in documents:
            logger.info(f"  [{doc['index']:02d}] [{doc['category']}] {doc['title']}")

        return {
            "issue_number": issue_number,
            "published_date": target_date.isoformat(),
            "documents": documents,
        }

    async def _get_issue_number(self, y: str, m: str, ds: str, doc_urls: list[str]) -> int | None:
        candidates = [
            f"{BASE_URL}/eskiler/{y}/{m}/{ds}.htm",
            f"{BASE_URL}/eskiler/{y}/{m}/{ds}-1.htm",
        ]
        candidates.extend(doc_urls[:3])

        tried: set[str] = set()
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
            for url in candidates:
                if url in tried:
                    continue
                tried.add(url)
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    text = _decode_response(resp)
                    issue = _extract_issue_number_from_text(text)
                    if issue is not None:
                        return issue
                except Exception:
                    continue
        return None

    async def _get_index_snapshot(self, y: str, m: str, ds: str) -> dict:
        url = f"{BASE_URL}/eskiler/{y}/{m}/{ds}.htm"

        try:
            async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return {"issue_number": None, "entries": [], "url": url}

            html_text = _decode_response(resp)
            issue = _extract_issue_number_from_text(html_text)
            soup = BeautifulSoup(html_text, "lxml")
            entries = self._extract_index_entries(soup)
            return {"issue_number": issue, "entries": entries, "url": url}
        except Exception:
            return {"issue_number": None, "entries": [], "url": url}

    def _extract_index_entries(self, soup: BeautifulSoup) -> list[dict]:
        entries: list[dict] = []
        seen: set[str] = set()

        raw_lines = [re.sub(r"\s+", " ", ln).strip() for ln in soup.get_text("\n").splitlines()]
        lines = [ln for ln in raw_lines if ln]

        def normalized(line: str) -> str:
            return re.sub(r"\s+", " ", _normalize_tr(line).lower()).strip()

        def is_noise_or_section(line: str) -> bool:
            n = normalized(line)
            if not n:
                return True
            if SKIP_LINE_RE.match(n):
                return True
            if n in INDEX_SECTION_SKIP:
                return True
            if any(skip in n for skip in INDEX_NAV_SKIP):
                return True
            if "kurumsal mobil uygulamasi" in n:
                return True
            if "tc resmi gazete" in n and "yerini almistir" in n:
                return True
            if re.match(r"^[abc]\s*[-–—]\s*", n):
                return True
            if re.match(r"^(yargi ilanlari|artirma\,? eksiltme ve ihale ilanlari|cesitli ilanlar)\b", n):
                return True
            return False

        def add_entry(title: str, doc_type: str) -> None:
            title = re.sub(r"\s+", " ", title).strip()
            title = re.sub(r"\s+([,.;:])", r"\1", title)

            title = re.sub(
                r"Resm[iî]\s+Gazete.?nin\s+kurumsal\s+mobil\s+uygulamas[ıi].*$",
                "",
                title,
                flags=re.IGNORECASE,
            ).strip()
            title = re.sub(r"kurumsal\s+mobil\s+uygulamas[ıi].*$", "", title, flags=re.IGNORECASE).strip()

            if len(title) < 12:
                return

            split_titles = [
                s.strip(" -—–")
                for s in re.split(r"\s+[—–-]{1,2}\s+", title)
                if s.strip(" -—–")
            ]
            if len(split_titles) > 1:
                for st in split_titles:
                    add_entry(st, doc_type)
                return

            n = normalized(title)
            if is_noise_or_section(title):
                return
            if len(n) < 12:
                return

            key = _title_key(title)
            if key in seen:
                return
            seen.add(key)

            entries.append(
                {
                    "title": title,
                    "raw_text": title,
                    "doc_type": doc_type,
                    "category": _detect_category(title),
                }
            )

        i = 0
        while i < len(lines):
            line = lines[i]
            bullet_match = re.match(r"^[—–-]\s*(.+)$", line)

            if bullet_match:
                parts = [bullet_match.group(1).strip()]
                j = i + 1

                while j < len(lines):
                    nxt = lines[j].strip()
                    if not nxt:
                        break
                    if re.match(r"^[—–-]\s+", nxt):
                        break
                    if is_noise_or_section(nxt):
                        break
                    if _is_heading_line(nxt) and len(nxt) <= 70:
                        break

                    parts.append(nxt)
                    j += 1

                add_entry(" ".join(parts), "IndexKaydi")
                i = j
                continue

            nline = normalized(line)
            if not is_noise_or_section(line) and _is_heading_line(line) and "karar" in nline:
                j = i + 1
                while j < len(lines):
                    nxt = lines[j].strip()
                    if not nxt:
                        break
                    if is_noise_or_section(nxt):
                        break
                    if re.match(r"^[—–-]\s+", nxt):
                        break
                    if not _is_heading_line(nxt):
                        break
                    line = f"{line} {nxt}"
                    j += 1

                add_entry(line, "IndexBaslik")
                i = j
                continue

            i += 1

        return entries
    def _merge_index_entries(
        self,
        documents: list[dict],
        index_entries: list[dict],
        index_url: str,
        issue_pdf_url: str,
    ) -> int:
        if not index_entries:
            return 0

        existing_keys = [_title_key(d.get("title", "")) for d in documents]
        added = 0

        for entry in index_entries:
            title = entry.get("title", "").strip()
            if not title:
                continue

            key = _title_key(title)
            if len(key) < 12:
                continue

            duplicate = False
            for ex in existing_keys:
                if not ex:
                    continue
                if key == ex or key in ex or ex in key:
                    duplicate = True
                    break

            if duplicate:
                continue

            documents.append(
                {
                    "index": len(documents) + 1,
                    "title": title,
                    "doc_type": entry.get("doc_type", "IndexKaydi"),
                    "raw_text": entry.get("raw_text", title),
                    "html_url": index_url,
                    "pdf_url": issue_pdf_url,
                    "local_pdf_path": None,
                    "category": entry.get("category") or _detect_category(title),
                }
            )
            existing_keys.append(key)
            added += 1

        return added

    async def _probe_document_urls(self, date_str: str, y: str, m: str) -> list[str]:
        urls: list[str] = []

        max_probe = 200
        max_consecutive_misses = 25

        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=10) as client:
            consecutive_misses = 0

            for i in range(1, max_probe + 1):
                url = f"{BASE_URL}/eskiler/{y}/{m}/{date_str}-{i}.htm"
                try:
                    resp = await client.head(url)
                    code = resp.status_code

                    if code in (200, 301, 302):
                        urls.append(url)
                        consecutive_misses = 0
                        logger.debug(f"  Probe hit: -{i}.htm")
                        continue

                    if code in (403, 405):
                        g = await client.get(url)
                        if g.status_code == 200:
                            urls.append(url)
                            consecutive_misses = 0
                            logger.debug(f"  Probe hit(GET): -{i}.htm")
                            continue

                    consecutive_misses += 1
                    if consecutive_misses >= max_consecutive_misses and i > max_consecutive_misses:
                        break
                except Exception:
                    consecutive_misses += 1
                    if consecutive_misses >= max_consecutive_misses and i > max_consecutive_misses:
                        break

        logger.info(f"Probe: {len(urls)} URL bulundu")
        return urls

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(min=1, max=5),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def _fetch_document(self, url: str, index: int, semaphore: asyncio.Semaphore) -> dict | None:
        async with semaphore:
            try:
                async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=30) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()

                html_text = _decode_response(resp)
                soup = BeautifulSoup(html_text, "lxml")

                title, doc_type = _extract_title_and_doctype(soup)
                raw_text = self._extract_text(html_text, soup)
                category = _detect_category(f"{title} {raw_text[:800]}")

                logger.debug(f"  [{index:02d}] {title}")

                return {
                    "index": index,
                    "title": title,
                    "doc_type": doc_type,
                    "raw_text": raw_text,
                    "html_url": url,
                    "pdf_url": url.replace(".htm", ".pdf"),
                    "local_pdf_path": None,
                    "category": category,
                }

            except httpx.HTTPStatusError as e:
                logger.warning(f"  [{index}] HTTP {e.response.status_code}: {url}")
                return None
            except Exception as e:
                logger.error(f"  [{index}] Hata: {e}")
                return None

    def _extract_text(self, html_text: str, soup: BeautifulSoup) -> str:
        text_bs4 = self._extract_text_bs4(soup)

        if _looks_dirty(text_bs4) or len(text_bs4) < 300:
            text_lxml = self._extract_text_lxml(html_text)
            if text_lxml and (len(text_lxml) > len(text_bs4) * 0.6) and not _looks_dirty(text_lxml):
                return text_lxml

        return text_bs4

    def _extract_text_bs4(self, soup: BeautifulSoup) -> str:
        s = BeautifulSoup(str(soup), "lxml")
        root = s.body or s

        for tag in root(["script", "style", "nav", "header", "footer", "xml", "meta", "link"]):
            tag.decompose()
        for c in root.find_all(string=lambda t: isinstance(t, Comment)):
            c.extract()

        raw = root.get_text("\n")
        return _clean_text_blob(raw)

    def _extract_text_lxml(self, html_text: str) -> str:
        if lxml_html is None:
            return ""

        try:
            root = lxml_html.fromstring(html_text)
            for bad in root.xpath("//script|//style|//nav|//header|//footer|//xml|//meta|//link"):
                bad.drop_tree()
            raw = root.text_content()
            return _clean_text_blob(raw)
        except Exception:
            return ""

    async def download_pdf(self, pdf_url: str, filename: str) -> Path | None:
        pdf_path = self.download_dir / filename
        if pdf_path.exists():
            return pdf_path

        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=120) as client:
            try:
                async with client.stream("GET", pdf_url) as resp:
                    resp.raise_for_status()
                    with open(pdf_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
                return pdf_path
            except Exception as e:
                logger.error(f"PDF hatasi [{filename}]: {e}")
                if pdf_path.exists():
                    pdf_path.unlink()
                return None

