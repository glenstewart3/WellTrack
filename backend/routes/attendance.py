from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from collections import defaultdict
from datetime import datetime, timezone
import asyncio
import uuid
import io
import csv
import re

from database import DEFAULT_ABSENCE_TYPES, PRESENT_STATUSES, FULL_PRESENT_STATUSES
from deps import get_tenant_db
from helpers import get_current_user, get_student_attendance_pct, get_student_attendance_stats, \
    get_bulk_attendance_stats, compute_att_stats
from utils.audit import log_audit

router = APIRouter()


def _classify_status(status: str, excluded_types: set) -> str:
    if not status:
        return "present"
    if status in excluded_types:
        return "excluded"
    if status == "Present" or status in FULL_PRESENT_STATUSES:
        return "present"
    return "absent"


def _build_monthly_trend(school_days_list: list, exc_by_date: dict, excluded_types: set) -> list:
    """Aggregate attendance into monthly buckets."""
    monthly_data: dict = {}
    for day in school_days_list:
        month = day[:7]
        if month not in monthly_data:
            monthly_data[month] = {"school_days": 0, "absent": 0.0}
        rec = exc_by_date.get(day)
        if rec:
            am = (rec.get("am_status") or "").strip()
            pm = (rec.get("pm_status") or "").strip()
            am_cls = _classify_status(am, excluded_types)
            pm_cls = _classify_status(pm, excluded_types)
            if am_cls == "excluded" and pm_cls == "excluded":
                continue
            monthly_data[month]["school_days"] += 1
            if am_cls == "absent" and pm_cls == "absent":
                monthly_data[month]["absent"] += 1.0
            elif am_cls == "absent" or pm_cls == "absent":
                monthly_data[month]["absent"] += 0.5
        else:
            monthly_data[month]["school_days"] += 1
    trend = []
    for k, v in sorted(monthly_data.items()):
        pct = round((v["school_days"] - v["absent"]) / v["school_days"] * 100, 1) if v["school_days"] > 0 else 100.0
        dt = datetime.fromisoformat(f"{k}-01")
        label = dt.strftime("%b %Y")
        trend.append({"period": k, "attendance_pct": pct, "label": label})
    return trend


@router.post("/attendance/upload")
async def upload_attendance(file: UploadFile = File(...), user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Exception-based upload: file contains only absences/exceptions."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Admin or leadership access required")
    content = await file.read()
    fname = (file.filename or "").lower()

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
        if not all_rows:
            return []
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
        name_by_id: dict = {}

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

            if raw_name:
                name_by_id[ext_id] = raw_name
            name_v = name_by_id.get(ext_id, '')

            if '[LEFT]' in name_v.upper():
                continue

            pref_m = re.search(r'\[([^\]]+)\]', name_v)
            pref_name = pref_m.group(1).strip() if pref_m else None

            date_str = _parse_date(dv)
            if not date_str:
                continue

            parsed.append({'external_id': ext_id, 'date': date_str,
                           'am_status': am_v, 'pm_status': pm_v, '_pref_name': pref_name})
        return parsed

    if fname.endswith('.csv'):
        text = content.decode('utf-8-sig')
        all_rows = list(csv.reader(io.StringIO(text)))
        records = _process_rows(all_rows)
    elif fname.endswith('.xlsx') or fname.endswith('.xls'):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
        ws = wb.active
        all_rows = list(ws.iter_rows(values_only=True))
        wb.close()
        records = _process_rows(all_rows)
    else:
        raise HTTPException(400, "Unsupported file format. Please upload a CSV or XLSX file.")

    if not records:
        raise HTTPException(400, "No valid records found in file")

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

    pref_name_by_ext: dict = {}
    for r in records:
        if r.get('_pref_name'):
            pref_name_by_ext[r['external_id']] = r['_pref_name']

    matched, unmatched = [], []
    stored_count = 0
    pref_updated = 0
    all_docs = []
    for ext_id, recs in by_ext.items():
        student_id = ext_to_student.get(ext_id)
        if student_id:
            dates = [r['date'] for r in recs]
            await db.attendance_records.delete_many({"student_id": student_id, "date": {"$in": dates}})
            docs = [{"student_id": student_id, "external_id": ext_id, "date": r['date'],
                     "am_status": r['am_status'], "pm_status": r['pm_status']} for r in recs]
            all_docs.extend(docs)
            stored_count += len(docs)
            if ext_id in pref_name_by_ext:
                await db.students.update_one(
                    {"student_id": student_id},
                    {"$set": {"preferred_name": pref_name_by_ext[ext_id]}}
                )
                pref_updated += 1
            matched.append(ext_id)
        else:
            unmatched.append(ext_id)

    if all_docs:
        await db.attendance_records.insert_many(all_docs, ordered=False)

    found_types = set()
    for r in records:
        for v in [r['am_status'], r['pm_status']]:
            if v:
                found_types.add(v)
    school_s = await db.school_settings.find_one({}, {"_id": 0})
    existing_types = set(school_s.get("absence_types") or DEFAULT_ABSENCE_TYPES)
    await db.school_settings.update_one({}, {"$set": {"absence_types": sorted(existing_types | found_types)}}, upsert=True)

    alerts_created = 0
    student_map = {s["student_id"]: s for s in await db.students.find(
        {"student_id": {"$in": list(ext_to_student.values())}}, {"_id": 0}).to_list(500)}

    matched_sids = [ext_to_student[ext_id] for ext_id in matched if ext_to_student.get(ext_id)]
    att_stats_map = await get_bulk_attendance_stats(db, matched_sids)

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

    result = {
        "processed": len(records), "absence_dates_in_file": absence_date_count,
        "matched_students": len(matched), "unmatched_students": len(unmatched),
        "stored_records": stored_count, "alerts_generated": alerts_created,
        "preferred_names_updated": pref_updated,
        "unmatched_ids": unmatched[:30],
    }
    await log_audit(db, user, "uploaded", "attendance", "", f"Attendance upload — {file.filename}",
                    bulk_count=stored_count,
                    metadata={"matched": len(matched), "unmatched": len(unmatched), "alerts": alerts_created})
    return result


@router.get("/attendance/summary")
async def get_attendance_summary(
    year: int = None,
    from_date: str = None,
    to_date: str = None,
    user=Depends(get_current_user), db=Depends(get_tenant_db)):
    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    current_year = year or (settings_doc or {}).get("current_year") or datetime.now(timezone.utc).year
    today_str = datetime.now(timezone.utc).date().isoformat()
    excluded_types = set((settings_doc or {}).get("excluded_absence_types", []))

    day_filter = {"year": current_year}
    if from_date and to_date:
        day_filter["date"] = {"$gte": from_date, "$lte": to_date}
    elif from_date:
        day_filter["date"] = {"$gte": from_date, "$lte": today_str}
    elif to_date:
        day_filter["date"] = {"$lte": to_date}
    else:
        day_filter["date"] = {"$lte": today_str}

    students_list = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students_list]
    school_days_list = await db.school_days.distinct("date", day_filter)

    if not school_days_list:
        total_sd = await db.school_days.count_documents({})
        if total_sd == 0:
            att_date_filter = {}
            if from_date:
                att_date_filter["$gte"] = from_date
            if to_date:
                att_date_filter["$lte"] = to_date
            fallback_dates = await db.attendance_records.distinct(
                "date", {"date": att_date_filter} if att_date_filter else {"date": {"$lte": today_str}}
            )
            school_days_list = sorted(fallback_dates) if fallback_dates else []

    att_map = await get_bulk_attendance_stats(db, student_ids, school_days_list=school_days_list, excluded_types=excluded_types)

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
async def get_student_attendance_detail(
    student_id: str,
    year: int = None,
    from_date: str = None,
    to_date: str = None,
    user=Depends(get_current_user), db=Depends(get_tenant_db)):
    settings_doc, records = await asyncio.gather(
        db.school_settings.find_one({}, {"_id": 0}),
        db.attendance_records.find({"student_id": student_id}, {"_id": 0}).sort("date", 1).to_list(3000),
    )
    excluded_types = set((settings_doc or {}).get("excluded_absence_types") or [])
    current_year = year or (settings_doc or {}).get("current_year")
    today_str = datetime.now(timezone.utc).date().isoformat()

    year_filter = {"year": current_year} if current_year else {}
    if from_date and to_date:
        year_filter["date"] = {"$gte": from_date, "$lte": to_date}
    elif from_date:
        year_filter["date"] = {"$gte": from_date, "$lte": today_str}
    elif to_date:
        year_filter["date"] = {"$lte": to_date}
    else:
        year_filter["date"] = {"$lte": today_str}

    school_days_list = await db.school_days.distinct("date", year_filter)

    if not school_days_list:
        total_sd = await db.school_days.count_documents({})
        if total_sd == 0:
            att_date_filter = {}
            if from_date:
                att_date_filter["$gte"] = from_date
            if to_date:
                att_date_filter["$lte"] = to_date
            fallback_dates = await db.attendance_records.distinct(
                "date", {"date": att_date_filter} if att_date_filter else {"date": {"$lte": today_str}}
            )
            school_days_list = sorted(fallback_dates) if fallback_dates else []

    exc_by_date = {r["date"]: r for r in records}

    stats = compute_att_stats(school_days_list, exc_by_date, excluded_types)
    total_days = stats["total_days"]
    absent_days = stats["absent_days"]
    att_pct = stats["pct"]

    absence_types: dict = {}
    school_days_set = set(school_days_list)
    for day, rec in exc_by_date.items():
        if day not in school_days_set:
            continue
        am = (rec.get("am_status") or "").strip()
        pm = (rec.get("pm_status") or "").strip()
        am_cls = _classify_status(am, excluded_types)
        pm_cls = _classify_status(pm, excluded_types)
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

    monthly_trend = _build_monthly_trend(school_days_list, exc_by_date, excluded_types)

    return {
        "student_id": student_id, "attendance_pct": round(att_pct, 1),
        "total_days": total_days, "absent_days": absent_days,
        "absence_types": absence_types, "monthly_trend": monthly_trend,
        "records": records[:300], "excluded_absence_types": list(excluded_types),
    }


@router.get("/attendance/types")
async def get_absence_types(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    types = (s.get("absence_types") if s else None) or DEFAULT_ABSENCE_TYPES
    excluded = (s.get("excluded_absence_types") if s else None) or []
    return {"types": types, "excluded_types": excluded}


@router.put("/attendance/types")
async def update_absence_types(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    await db.school_settings.update_one({}, {"$set": {"absence_types": data.get("types", [])}}, upsert=True)
    return {"types": data.get("types", [])}
