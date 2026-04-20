"""Unit tests for the new time-based attendance calculation and entry_date logic."""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from helpers import compute_att_stats


# ── _compute_present_pct equivalent (pure math, copied from upload_attendance) ──
SCHOOL_START = 8 * 60 + 50       # 530
AM_END = 12 * 60 + 5             # 725
PM_START = AM_END
SCHOOL_END = 15 * 60 + 20        # 920
FULL = SCHOOL_END - SCHOOL_START  # 390
HALF = AM_END - SCHOOL_START      # 195


def _mins(hhmm):
    if hhmm is None:
        return None
    s = str(hhmm).strip().replace(":", "").replace(" ", "")
    if "." in s:
        s = s.split(".", 1)[0]
    if not s.isdigit():
        return None
    n = int(s)
    if n <= 0:
        return None
    h, m = divmod(n, 100)
    if h > 23 or m > 59:
        return None
    return h * 60 + m


def _truthy(v):
    if v is None:
        return False
    s = str(v).strip().upper()
    return s not in ("", "0", "N", "NO", "FALSE", "F")


def compute_present_pct(am_att, am_late, am_early, pm_att, pm_late, pm_early):
    # AM
    if not _truthy(am_att):
        am = 0
    else:
        am = HALF
        late = _mins(am_late)
        if late is not None:
            c = max(SCHOOL_START, min(AM_END, late))
            am -= (c - SCHOOL_START)
        early = _mins(am_early)
        if early is not None:
            c = max(SCHOOL_START, min(AM_END, early))
            am -= (AM_END - c)
        am = max(0, am)
    # PM
    if not _truthy(pm_att):
        pm = 0
    else:
        pm = HALF
        late = _mins(pm_late)
        if late is not None:
            c = max(PM_START, min(SCHOOL_END, late))
            pm -= (c - PM_START)
        early = _mins(pm_early)
        if early is not None:
            c = max(PM_START, min(SCHOOL_END, early))
            pm -= (SCHOOL_END - c)
        pm = max(0, pm)
    return round((am + pm) / FULL, 4)


def test_full_day_present():
    # Both sessions fully attended → 1.0
    assert compute_present_pct(1, None, None, 1, None, None) == 1.0


def test_fully_absent():
    assert compute_present_pct(0, None, None, 0, None, None) == 0.0


def test_am_only_absent():
    # Missed full AM but attended full PM = 195 / 390 = 0.5
    assert compute_present_pct(0, None, None, 1, None, None) == 0.5


def test_late_arrival_am():
    # Arrived 9:33 AM → 43 min lost out of 390
    # Present = 390 - 43 = 347 → 347/390 ≈ 0.8897
    pct = compute_present_pct(1, 933, None, 1, None, None)
    assert abs(pct - (347 / 390)) < 0.0001


def test_early_left_am_1030():
    # Left 10:30 AM during AM → lost 12:05-10:30 = 95 min
    pct = compute_present_pct(1, None, 1030, 1, None, None)
    assert abs(pct - ((390 - 95) / 390)) < 0.0001


def test_pm_late_arrival():
    # PM_LATE_ARRIVAL 1330 → arrived 1:30 PM. Lost 12:05 to 13:30 = 85 min
    pct = compute_present_pct(1, None, None, 1, 1330, None)
    assert abs(pct - ((390 - 85) / 390)) < 0.0001


def test_combined_partial():
    # Late AM 9:33, early PM leave at 14:00 → AM loses 43 min, PM loses 15:20-14:00 = 80 min
    pct = compute_present_pct(1, 933, None, 1, None, 1400)
    assert abs(pct - ((390 - 43 - 80) / 390)) < 0.0001


def test_invalid_time_ignored():
    # Garbage HHMM returns None, treated as full attendance
    assert compute_present_pct(1, "abc", None, 1, None, None) == 1.0


# ── compute_att_stats w/ present_pct and entry_date ──────────────────────────
def test_att_stats_with_present_pct():
    days = ["2025-01-10", "2025-01-11", "2025-01-12"]
    exc = {
        "2025-01-10": {"present_pct": 0.5, "am_status": "Absent", "pm_status": "Present"},
        "2025-01-12": {"present_pct": 0.0, "am_status": "Absent", "pm_status": "Absent"},
    }
    stats = compute_att_stats(days, exc, set())
    # absent_days = (1-0.5) + 0 + (1-0.0) = 1.5 over 3 days → 50%
    assert stats["total_days"] == 3
    assert abs(stats["absent_days"] - 1.5) < 0.0001
    assert abs(stats["pct"] - 50.0) < 0.01


def test_att_stats_respects_entry_date():
    # Student entered on 2025-01-15. Days before that shouldn't count.
    days = ["2025-01-10", "2025-01-11", "2025-01-15", "2025-01-16"]
    exc = {
        "2025-01-10": {"present_pct": 0.0, "am_status": "Absent", "pm_status": "Absent"},
        "2025-01-16": {"present_pct": 0.0, "am_status": "Absent", "pm_status": "Absent"},
    }
    stats = compute_att_stats(days, exc, set(), entry_date="2025-01-15")
    # Only Jan 15 & 16 counted. 1 absent of 2 = 50%
    assert stats["total_days"] == 2
    assert abs(stats["absent_days"] - 1.0) < 0.0001
    assert abs(stats["pct"] - 50.0) < 0.01


def test_att_stats_legacy_half_day():
    # No present_pct → fall back to classification logic
    days = ["2025-01-10", "2025-01-11"]
    exc = {
        "2025-01-10": {"am_status": "Absent", "pm_status": "Present"},  # half day
    }
    stats = compute_att_stats(days, exc, set())
    assert abs(stats["absent_days"] - 0.5) < 0.0001
    assert abs(stats["pct"] - 75.0) < 0.01


def test_att_stats_no_entry_date_counts_all():
    days = ["2025-01-10", "2025-01-11"]
    stats = compute_att_stats(days, {}, set())
    assert stats["total_days"] == 2
    assert stats["pct"] == 100.0


if __name__ == "__main__":
    # Run all tests
    import inspect
    mod = sys.modules[__name__]
    tests = [name for name, obj in inspect.getmembers(mod, inspect.isfunction) if name.startswith("test_")]
    failed = 0
    for name in tests:
        try:
            getattr(mod, name)()
            print(f"✓ {name}")
        except AssertionError as e:
            print(f"✗ {name}: {e}")
            failed += 1
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
