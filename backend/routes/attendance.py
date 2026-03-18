from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from collections import defaultdict
from datetime import datetime, timezone
import uuid, io, csv, openpyxl

from database import db, DEFAULT_ABSENCE_TYPES, PRESENT_STATUSES
from helpers import get_current_user, get_student_attendance_pct, get_student_attendance_stats

router = APIRouter()


@router.post("/attendance/upload")
async def upload_attendance(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Exception-based upload: file contains only absences/exceptions."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Admin or leadership access required")
    content = await file.read()
    fname = (file.filename or "").lower()
    records = []

    if fname.endswith('.xlsx') or fname.endswith('.xls'):
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        headers = [str(cell.value or '').strip().upper() for cell in ws[1]]

        def col(names):
            for n in names:
                for i, h in enumerate(headers):
                    if h == n.upper() or h.startswith(n.upper()):
                        return i
            return None

        id_c = col(['SUSSIID', 'SUSSI ID', 'ID', 'STUDENT ID', 'STUDENTID', 'STUDENT CODE'])
        dt_c = col(['DATE'])
        am_c = col(['AM'])
        pm_c = col(['PM'])
        if id_c is None or dt_c is None:
            raise HTTPException(400, "Could not find ID or Date column")
        for row in ws.iter_rows(min_row=2, values_only=True):
            ext_id = str(row[id_c] or '').strip() if id_c is not None else ''
            dv = row[dt_c] if dt_c is not None else ''
            am_v = str(row[am_c] or '').strip() if am_c is not None else ''
            pm_v = str(row[pm_c] or '').strip() if pm_c is not None else ''
            if not ext_id or not dv:
                continue
            if hasattr(dv, 'strftime'):
                date_str = dv.strftime('%Y-%m-%d')
            else:
                ds = str(dv).strip()
                for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
                    try:
                        date_str = datetime.strptime(ds, fmt).strftime('%Y-%m-%d')
                        break
                    except Exception:
                        pass
                else:
                    continue
            records.append({'external_id': ext_id.upper(), 'date': date_str, 'am_status': am_v, 'pm_status': pm_v})

    elif fname.endswith('.csv'):
        text = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            ext_id = (row.get('SussiId') or row.get('SUSSIID') or row.get('ID') or
                      row.get('Student ID') or row.get('student_id') or '').strip().upper()
            date_str = (row.get('Date') or row.get('date') or '').strip()
            am_v = (row.get('AM') or row.get('am') or '').strip()
            pm_v = (row.get('PM') or row.get('pm') or '').strip()
            if not ext_id or not date_str:
                continue
            for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
                try:
                    date_str = datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
                    break
                except Exception:
                    pass
            records.append({'external_id': ext_id, 'date': date_str, 'am_status': am_v, 'pm_status': pm_v})
    else:
        raise HTTPException(400, "Unsupported file format. Use XLSX or CSV.")

    if not records:
        raise HTTPException(400, "No valid records found in file")

    unique_dates = list({r['date'] for r in records})
    for d in unique_dates:
        await db.school_days.update_one({"date": d}, {"$set": {"date": d}}, upsert=True)

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

    matched, unmatched = [], []
    stored_count = 0
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

    # Auto-generate attendance alerts
    alerts_created = 0
    student_map = {s["student_id"]: s for s in await db.students.find(
        {"student_id": {"$in": list(ext_to_student.values())}}, {"_id": 0}).to_list(500)}

    for ext_id in matched:
        sid = ext_to_student.get(ext_id)
        if not sid:
            continue
        s = student_map.get(sid, {})
        pref = s.get("preferred_name")
        display = f"{s.get('first_name', '')}{ (' (' + pref + ')') if pref else ''} {s.get('last_name', '')}".strip()
        att_pct = await get_student_attendance_pct(sid)

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
        "processed": len(records), "school_days_registered": len(unique_dates),
        "matched_students": len(matched), "unmatched_students": len(unmatched),
        "stored_records": stored_count, "alerts_generated": alerts_created,
        "unmatched_ids": unmatched[:30],
    }


@router.get("/attendance/summary")
async def get_attendance_summary(user=Depends(get_current_user)):
    students_list = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    school_days_list = await db.school_days.distinct("date")
    result = []
    for s in students_list:
        stats = await get_student_attendance_stats(s["student_id"])
        att_pct = stats["pct"]
        has_data = len(school_days_list) > 0 or stats["total_sessions"] > 0
        if not has_data:
            result.append({**s, "attendance_pct": None, "total_sessions": 0, "absent_sessions": 0,
                           "has_data": False, "attendance_tier": None})
            continue
        tier = 1 if att_pct >= 95 else (2 if att_pct >= 90 else 3)
        result.append({**s, "attendance_pct": round(att_pct, 1), "total_sessions": stats["total_sessions"],
                       "absent_sessions": stats["absent_sessions"], "has_data": True, "attendance_tier": tier})
    return result


@router.get("/attendance/student/{student_id}")
async def get_student_attendance_detail(student_id: str, user=Depends(get_current_user)):
    records = await db.attendance_records.find({"student_id": student_id}, {"_id": 0}).sort("date", 1).to_list(3000)
    total_sessions, absent_sessions = 0, 0
    absence_types: dict = {}
    monthly_data: dict = {}
    for r in records:
        for sess_key, sess_v in [("am_status", r.get("am_status", "")), ("pm_status", r.get("pm_status", ""))]:
            v = (sess_v or "").strip()
            month = r.get("date", "")[:7]
            if v:
                total_sessions += 1
                if month not in monthly_data:
                    monthly_data[month] = {"sessions": 0, "absent": 0}
                monthly_data[month]["sessions"] += 1
                if v not in PRESENT_STATUSES:
                    absent_sessions += 1
                    absence_types[v] = absence_types.get(v, 0) + 1
                    monthly_data[month]["absent"] += 1
    att_pct = ((total_sessions - absent_sessions) / total_sessions * 100) if total_sessions > 0 else 100.0
    monthly_trend = [
        {"month": k, "attendance_pct": round(((v["sessions"] - v["absent"]) / v["sessions"] * 100) if v["sessions"] > 0 else 100, 1)}
        for k, v in sorted(monthly_data.items())
    ]
    return {
        "student_id": student_id, "attendance_pct": round(att_pct, 1),
        "total_sessions": total_sessions, "absent_sessions": absent_sessions,
        "absence_types": absence_types, "monthly_trend": monthly_trend, "records": records[:300],
    }


@router.get("/attendance/types")
async def get_absence_types(user=Depends(get_current_user)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    return {"types": (s.get("absence_types") if s else None) or DEFAULT_ABSENCE_TYPES}


@router.put("/attendance/types")
async def update_absence_types(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    await db.school_settings.update_one({}, {"$set": {"absence_types": data.get("types", [])}}, upsert=True)
    return {"types": data.get("types", [])}
