"""Unit tests for the ZIP photo-upload name matcher.

Verifies the 5 real-world filenames that previously failed to match are now
resolved correctly via token + normalisation fallbacks.
"""
import unicodedata


def _norm(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(c.lower() for c in s if c.isalnum())


def _tokens(s: str):
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


def _build_index(students):
    return [
        {
            "student_id": s["student_id"],
            "fn_norm": _norm(s.get("first_name", "")),
            "ln_norm": _norm(s.get("last_name", "")),
            "pn_norm": _norm(s.get("preferred_name", "")),
            "fn_tokens": _tokens(s.get("first_name", "")),
            "ln_tokens": _tokens(s.get("last_name", "")),
        }
        for s in students
    ]


def _match(index, last_name, first_name):
    ln_n, fn_n = _norm(last_name), _norm(first_name)
    if not ln_n or not fn_n:
        return None
    for rec in index:
        if rec["ln_norm"] == ln_n and (rec["fn_norm"] == fn_n or rec["pn_norm"] == fn_n):
            return rec
    for rec in index:
        if ln_n in rec["ln_tokens"] and (rec["fn_norm"] == fn_n or rec["pn_norm"] == fn_n):
            return rec
    for rec in index:
        if rec["ln_norm"] == ln_n and fn_n in rec["fn_tokens"]:
            return rec
    for rec in index:
        if ln_n in rec["ln_tokens"] and fn_n in rec["fn_tokens"]:
            return rec
    return None


# Real-world roster mirroring the user's reported cases
STUDENTS = [
    {"student_id": "S001", "first_name": "Holly",              "last_name": "ERSCH- MAHY", "preferred_name": ""},
    {"student_id": "S002", "first_name": "Mason",              "last_name": "ONEILL",       "preferred_name": ""},
    {"student_id": "S003", "first_name": "Nur Fathiya Adira",  "last_name": "YUSRON",       "preferred_name": ""},
    {"student_id": "S004", "first_name": "Yshka",              "last_name": "OBRIEN",       "preferred_name": ""},
    {"student_id": "S005", "first_name": "Zian",               "last_name": "OBRIEN",       "preferred_name": ""},
    # Control cases
    {"student_id": "S006", "first_name": "Emma",               "last_name": "Smith",        "preferred_name": ""},
    {"student_id": "S007", "first_name": "James",              "last_name": "Brown",        "preferred_name": "Jim"},
]
INDEX = _build_index(STUDENTS)


def test_compound_last_name_with_trailing_space():
    # File: "Mahy, Holly .jpg"  (after split/strip: "Mahy" + "Holly")
    r = _match(INDEX, "Mahy", "Holly")
    assert r and r["student_id"] == "S001"


def test_apostrophe_in_filename_stored_without():
    # File: "O'Neill, Mason.jpg"
    r = _match(INDEX, "O'Neill", "Mason")
    assert r and r["student_id"] == "S002"


def test_multi_token_first_name():
    # File: "Yusron, Adira.jpg"  — student has "Nur Fathiya Adira"
    r = _match(INDEX, "Yusron", "Adira")
    assert r and r["student_id"] == "S003"


def test_apostrophe_obrien_yshka():
    r = _match(INDEX, "O'Brien", "Yshka")
    assert r and r["student_id"] == "S004"


def test_apostrophe_obrien_zian():
    r = _match(INDEX, "O'Brien", "Zian")
    assert r and r["student_id"] == "S005"


def test_plain_exact_match_still_works():
    r = _match(INDEX, "Smith", "Emma")
    assert r and r["student_id"] == "S006"


def test_preferred_name_match():
    # File "Brown, Jim.jpg"  — matches preferred_name "Jim"
    r = _match(INDEX, "Brown", "Jim")
    assert r and r["student_id"] == "S007"


def test_curly_apostrophe_normalised():
    # Windows/Mac smart quote
    r = _match(INDEX, "O\u2019Neill", "Mason")
    assert r and r["student_id"] == "S002"


def test_case_insensitive():
    r = _match(INDEX, "SMITH", "emma")
    assert r and r["student_id"] == "S006"


def test_no_false_positive():
    # Random name that shouldn't match anyone
    r = _match(INDEX, "Nobody", "Bob")
    assert r is None
