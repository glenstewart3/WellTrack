"""Test photo-match logic including flexible filename parsing and nickname fuzzy matching."""
import unicodedata
from difflib import SequenceMatcher


def _norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(c.lower() for c in s if c.isalnum())


def _tokens(s):
    if not s:
        return []
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    buf, out = [], []
    for c in s:
        if c.isalnum():
            buf.append(c.lower())
        elif buf:
            out.append("".join(buf))
            buf = []
    if buf:
        out.append("".join(buf))
    return out


def _first_name_similarity(a, b):
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    if len(shorter) >= 3 and longer.startswith(shorter):
        return 0.9
    common_prefix = 0
    for i in range(min(len(shorter), len(longer))):
        if shorter[i] == longer[i]:
            common_prefix += 1
        else:
            break
    base = SequenceMatcher(None, a, b).ratio()
    if common_prefix >= 3:
        return max(base, 0.75)
    if common_prefix >= 2 and len(shorter) >= 3:
        return max(base, 0.6)
    return base


def _parse_stem(stem):
    stem = (stem or "").strip()
    if not stem:
        return None, None
    if "," in stem:
        last_raw, first_raw = stem.split(",", 1)
        return last_raw.strip(), first_raw.strip()
    if "_" in stem and " " not in stem:
        parts = stem.split("_", 1)
        if len(parts) == 2:
            return parts[0].strip(), parts[1].strip()
    toks = stem.split()
    if len(toks) >= 2:
        return toks[-1].strip(), " ".join(toks[:-1]).strip()
    return None, None


def test_parse_stem_comma():
    assert _parse_stem("Simpkin, Lucy") == ("Simpkin", "Lucy")


def test_parse_stem_underscore():
    assert _parse_stem("Smith_Jane") == ("Smith", "Jane")


def test_parse_stem_space():
    # "Jane Smith.jpg" → last=Smith, first=Jane
    assert _parse_stem("Jane Smith") == ("Smith", "Jane")


def test_parse_stem_multi_token_space():
    # Multi-word: "Lucy Anne Simpkin" → last=Simpkin, first="Lucy Anne"
    assert _parse_stem("Lucy Anne Simpkin") == ("Simpkin", "Lucy Anne")


def test_parse_stem_empty():
    assert _parse_stem("") == (None, None)
    assert _parse_stem("Solo") == (None, None)


def test_first_name_similarity_nickname_prefix():
    # Mike ↔ Michael (2-char shared prefix → boosted)
    assert _first_name_similarity(_norm("Mike"), _norm("Michael")) >= 0.5
    # Sam ↔ Samuel (3-char prefix match)
    assert _first_name_similarity(_norm("Sam"), _norm("Samuel")) >= 0.85
    # Chris ↔ Christopher (prefix)
    assert _first_name_similarity(_norm("Chris"), _norm("Christopher")) >= 0.85


def test_first_name_similarity_identical():
    assert _first_name_similarity("jane", "jane") == 1.0


def test_first_name_similarity_unrelated():
    # Jane ↔ Bob (completely different) should be low
    assert _first_name_similarity(_norm("Jane"), _norm("Bob")) < 0.5


def test_first_name_similarity_fuzzy():
    # Rob ↔ Robert (prefix)
    assert _first_name_similarity(_norm("Rob"), _norm("Robert")) >= 0.85
    # Kate ↔ Katherine (3 shared prefix chars)
    assert _first_name_similarity(_norm("Kate"), _norm("Katherine")) >= 0.7
