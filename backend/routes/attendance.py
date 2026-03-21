from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from collections import defaultdict
from datetime import datetime, timezone
import asyncio
import uuid
import io
import csv
import re
import openpyxl

from database import db, DEFAULT_ABSENCE_TYPES, PRESENT_STATUSES, FULL_PRESENT_STATUSES
from helpers import get_current_user, get_student_attendance_pct, get_student_attendance_stats, \
    get_bulk_attendance_stats, compute_att_stats

router = APIRouter()


@router.post("/attendance/upload")
async def upload_attendance(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Exception-based upload: file contains only absences/exceptions."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Admin or leadership access required")
    content = await file.read()
    fname = (file.filename or "").lower()

    # ── shared helpers ────────────────────────────────────────────────────────
    def _find_col(headers, names, fallback=None):
        for n in names:
            for i, h in enumerate(headers):
                if h == n.upper() or h.startswith(n.upper()):
                    return i
        return fallback

    def _parse_date(dv):
        if hasattr(dv, 'strftime'):
            return dv.strftime('%Y-%m-%d')
        ds = str(dv).strip()
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d %b %Y', '%d %B %Y',
                    '%d/%m/%y', '%Y/%m/%d'):
            try:
                return datetime.strptime(ds, fmt).strftime('%Y-%m-%d')
            except Exception:
                pass
        return None

    def _process_rows(all_rows):
        """Convert a list-of-lists (any format) into attendance record dicts.

        Handles:
        - Empty/merged columns between data columns (e.g. ID, _, _, Date, _, AM)
        - Title rows before the header row
        - Student name only present on the first row per student ID
        """
        if not all_rows:
            return []

        # Find header row: first of the first 20 rows that contains 'ID'
        header_idx = 0
        headers = []
        for i, row in enumerate(all_rows[:20]):
            cells = [str(v or '').strip().upper() for v in row]
            if 'ID' in cells or any(c in ('DATE', 'ABSENCE DATE') for c in cells):
                header_idx = i
                headers = cells
                break
        if not headers:
            headers = [str(v or '').strip().upper() for v in all_rows[0]]

        id_c   = _find_col(headers, ['ID', 'SUSSIID', 'SUSSI ID', 'STUDENT ID', 'STUDENTID',
                                     'STUDENT CODE', 'COMPASS', 'ROLL'], fallback=0)
        dt_c   = _find_col(headers, ['DATE', 'ABSENCE DATE', 'ABS DATE', 'ABSDATE'], fallback=7)
        name_c = _find_col(headers, ['STUDENT NAME', 'FULL NAME', 'NAME', 'STUDENT'], fallback=2)
        am_c   = _find_col(headers, ['AM'], fallback=None)
        pm_c   = _find_col(headers, ['PM'], fallback=None)

        parsed = []
        name_by_id: dict = {}   # carry forward — name only on first row per student

        for row in all_rows[header_idx + 1:]:
            if id_c is None or dt_c is None:
                continue
            ext_id   = str(row[id_c] or '').strip().upper() if id_c < len(row) else ''
            dv       = row[dt_c] if dt_c < len(row) else ''
            am_v     = str(row[am_c] or '').strip() if am_c is not None and am_c < len(row) else ''
            pm_v     = str(row[pm_c] or '').strip() if pm_c is not None and pm_c < len(row) else ''
            raw_name = str(row[name_c] or '').strip() if name_c is not None and name_c < len(row) else ''

            if not ext_id or not dv:
                continue

            # Carry forward student name — only the first row per student has it
            if raw_name:
                name_by_id[ext_id] = raw_name
            name_v = name_by_id.get(ext_id, '')

            # Skip students who have left
            if '[LEFT]' in name_v.upper():
                continue

            # Extract preferred name from brackets e.g. "Smith, John [Jet]"
            pref_m = re.search(r'\[([^\]]+)\]', name_v)
            pref_name = pref_m.group(1).strip() if pref_m else None

            date_str = _parse_date(dv)
            if not date_str:
                continue

            parsed.append({'external_id': ext_id, 'date': date_str,
                           'am_status': am_v, 'pm_status': pm_v, '_pref_name': pref_name})
        return parsed

    # ── file reading ──────────────────────────────────────────────────────────
    if fname.endswith('.xlsx') or fname.endswith('.xls'):
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        all_rows = [list(row) for row in ws.iter_rows(values_only=True)]
        records = _process_rows(all_rows)

    elif fname.endswith('.csv'):
        text = content.decode('utf-8-sig')
        all_rows = list(csv.reader(io.StringIO(text)))
        records = _process_rows(all_rows)

    else:
        raise HTTPException(400, "Unsupported file format. Use XLSX or CSV.")

    if not records:
        raise HTTPException(400, "No valid records found in file")

    # Count unique absence dates for reporting (school_days are defined via Settings → Calendar)
    absence_date_count = len({r['date'] for r in records})

    students_list = await db.students.find({}, {"_id": 0, "student_id": 1, "external_id": 1, "sussi_id": 1}).to_list(1000)
    ext_to_student = {}
    for s in students_list:
        if s.get("sussi_id"):
            ext_to_student[s["sussi_id"].upper()] = s["student_id"]
        if s.get("external_id"):
            ext_to_student[s["external_id"].upper()] = s["student_id"]

    by_ext = defaultdict(list)
    for r in records:
        by_ext[r['external_id']].append(r)

    # Collect one preferred name per ext_id (last non-null wins)
    pref_name_by_ext: dict = {}
    for r in records:
        if r.get('_pref_name'):
            pref_name_by_ext[r['external_id']] = r['_pref_name']

    matched, unmatched = [], []
    stored_count = 0
    pref_updated = 0
    for ext_id, recs in by_ext.items():
        student_id = ext_to_student.get(ext_id)
        if student_id:
            for r in recs:
                await db.attendance_records.delete_one({"student_id": student_id, "date": r['date']})
            docs = [{"student_id": student_id, "external_id": ext_id, "date": r['date'],
                     "am_status": r['am_status'], "pm_status": r['pm_status']} for r in recs]
            if docs:
                await db.attendance_records.insert_many(docs)
                stored_count += len(docs)
            # Update preferred name if discovered from file
            if ext_id in pref_name_by_ext:
                await db.students.update_one(
                    {"student_id": student_id},
                    {"$set": {"preferred_name": pref_name_by_ext[ext_id]}}
                )
                pref_updated += 1
            matched.append(ext_id)
        else:
            unmatched.append(ext_id)

    # Discover new absence types
    found_types = set()
    for r in records:
        for v in [r['am_status'], r['pm_status']]:
            if v:
                found_types.add(v)
    school_s = await db.school_settings.find_one({}, {"_id": 0})
    existing_types = set(school_s.get("absence_types") or DEFAULT_ABSENCE_TYPES)
    await db.school_settings.update_one({}, {"$set": {"absence_types": sorted(existing_types | found_types)}}, upsert=True)

    # Auto-generate attendance alerts (batch pct lookup)
    alerts_created = 0
    student_map = {s["student_id"]: s for s in await db.students.find(
        {"student_id": {"$in": list(ext_to_student.values())}}, {"_id": 0}).to_list(500)}

    matched_sids = [ext_to_student[ext_id] for ext_id in matched if ext_to_student.get(ext_id)]
    att_stats_map = await get_bulk_attendance_stats(matched_sids)

    for ext_id in matched:
        sid = ext_to_student.get(ext_id)
        if not sid:
            continue
        s = student_map.get(sid, {})
        pref = s.get("preferred_name")
        if pref and pref == s.get("first_name"):
            pref = None
        display = f"{s.get('first_name', '')}{ (' (' + pref + ')') if pref else ''} {s.get('last_name', '')}".strip()
        att_pct = att_stats_map.get(sid, {}).get("pct", 100.0)

        if att_pct < 80:
            severity, alert_type = "high", "low_attendance_80"
            msg = f"{display} critically low attendance ({att_pct:.0f}%)"
        elif att_pct < 90:
            severity, alert_type = "medium", "low_attendance_90"
            msg = f"{display} attendance below 90% ({att_pct:.0f}%)"
        else:
            await db.alerts.update_many(
                {"student_id": sid, "alert_type": {"$in": ["low_attendance_80", "low_attendance_90"]}, "status": "pending"},
                {"$set": {"resolved": True, "status": "resolved"}}
            )
            continue

        await db.alerts.update_one(
            {"student_id": sid, "alert_type": {"$in": ["low_attendance_80", "low_attendance_90"]}, "status": "pending"},
            {"$set": {
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}",
                "student_id": sid, "student_name": display, "class_name": s.get("class_name", ""),
                "type": "early_warning", "alert_type": alert_type, "severity": severity, "message": msg,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_read": False, "resolved": False, "status": "pending"
            }},
            upsert=True
        )
        alerts_created += 1

    return {
        "processed": len(records), "absence_dates_in_file": absence_date_count,
        "matched_students": len(matched), "unmatched_students": len(unmatched),
        "stored_records": stored_count, "alerts_generated": alerts_created,
        "preferred_names_updated": pref_updated,
        "unmatched_ids": unmatched[:30],
    }


@router.get("/attendance/summary")
async def get_attendance_summary(user=Depends(get_current_user)):
    students_list = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students_list]
    # get_bulk_attendance_stats handles year-scoping internally
    att_map = await get_bulk_attendance_stats(student_ids)
    result = []
    for s in students_list:
        sid = s["student_id"]
        stats = att_map.get(sid, {"pct": 100.0, "total_days": 0, "absent_days": 0.0})
        att_pct = stats["pct"]
        has_data = stats["total_days"] > 0
        if not has_data:
            result.append({**s, "attendance_pct": None, "total_days": 0, "absent_days": 0.0,
                           "has_data": False, "attendance_tier": None})
            continue
        tier = 1 if att_pct >= 95 else (2 if att_pct >= 90 else 3)
        result.append({**s, "attendance_pct": round(att_pct, 1), "total_days": stats["total_days"],
                       "absent_days": stats["absent_days"], "has_data": True, "attendance_tier": tier})
    return result


@router.get("/attendance/student/{student_id}")
async def get_student_attendance_detail(student_id: str, user=Depends(get_current_user)):
    settings_doc, records = await asyncio.gather(
        db.school_settings.find_one({}, {"_id": 0}),
        db.attendance_records.find({"student_id": student_id}, {"_id": 0}).sort("date", 1).to_list(3000),
    )
    excluded_types = set((settings_doc or {}).get("excluded_absence_types") or [])
    year = (settings_doc or {}).get("current_year")
    today_str = datetime.now(timezone.utc).date().isoformat()
    year_filter = {"year": year, "date": {"$lte": today_str}} if year else {"date": {"$lte": today_str}}
    school_days_list = await db.school_days.distinct("date", year_filter)

    exc_by_date = {r["date"]: r for r in records}

    # Use the same logic as the summary list (term calendar as denominator)
    stats = compute_att_stats(school_days_list, exc_by_date, excluded_types)
    total_days = stats["total_days"]
    absent_days = stats["absent_days"]
    att_pct = stats["pct"]

    def _classify(s: str) -> str:
        if not s:
            return "present"
        if s in excluded_types:
            return "excluded"
        if s == "Present" or s in FULL_PRESENT_STATUSES:
            return "present"
        return "absent"

    # Monthly trend — use school_days as denominator per month
    monthly_data: dict = {}
    for day in school_days_list:
        month = day[:7]
        if month not in monthly_data:
            monthly_data[month] = {"school_days": 0, "absent": 0.0}
        if day not in exc_by_date:
            monthly_data[month]["school_days"] += 1
        else:
            rec = exc_by_date[day]
            am_cls = _classify((rec.get("am_status") or "").strip())
            pm_cls = _classify((rec.get("pm_status") or "").strip())
            if am_cls == "excluded" and pm_cls == "excluded":
                continue
            monthly_data[month]["school_days"] += 1
            if am_cls == "absent" and pm_cls == "absent":
                monthly_data[month]["absent"] += 1.0
            elif am_cls == "absent" or pm_cls == "absent":
                monthly_data[month]["absent"] += 0.5

    monthly_trend = [
        {"month": k, "attendance_pct": round(
            ((v["school_days"] - v["absent"]) / v["school_days"] * 100) if v["school_days"] > 0 else 100.0, 1
        )}
        for k, v in sorted(monthly_data.items())
    ]

    # Absence type breakdown — count only absences on school days
    absence_types: dict = {}
    school_days_set = set(school_days_list)
    for day, rec in exc_by_date.items():
        if day not in school_days_set:
            continue
        am = (rec.get("am_status") or "").strip()
        pm = (rec.get("pm_status") or "").strip()
        am_cls = _classify(am)
        pm_cls = _classify(pm)
        if am_cls == "absent" and pm_cls == "absent":
            if am == pm:
                absence_types[am] = absence_types.get(am, 0) + 1.0
            else:
                absence_types[am] = absence_types.get(am, 0) + 0.5
                absence_types[pm] = absence_types.get(pm, 0) + 0.5
        elif am_cls == "absent":
            absence_types[am] = absence_types.get(am, 0) + 0.5
        elif pm_cls == "absent":
            absence_types[pm] = absence_types.get(pm, 0) + 0.5

    return {
        "student_id": student_id, "attendance_pct": round(att_pct, 1),
        "total_days": total_days, "absent_days": absent_days,
        "absence_types": absence_types, "monthly_trend": monthly_trend, "records": records[:300],
    }


@router.get("/attendance/types")
async def get_absence_types(user=Depends(get_current_user)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    types = (s.get("absence_types") if s else None) or DEFAULT_ABSENCE_TYPES
    excluded = (s.get("excluded_absence_types") if s else None) or []
    return {"types": types, "excluded_types": excluded}


@router.put("/attendance/types")
async def update_absence_types(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    await db.school_settings.update_one({}, {"$set": {"absence_types": data.get("types", [])}}, upsert=True)
    return {"types": data.get("types", [])}
