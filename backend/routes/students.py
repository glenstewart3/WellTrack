from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional
import uuid, zipfile, io, re, os, csv
from pathlib import Path
from PIL import Image

from database import db
import asyncio
from helpers import get_current_user, get_student_attendance_pct, compute_mtss_tier, \
    get_bulk_attendance_stats, get_latest_saebrs_bulk, get_latest_saebrs_plus_bulk
from models import Student

# Default: <backend_root>/uploads/student_photos  (works on any server without /app)
_default_photos = Path(__file__).resolve().parent.parent / "uploads" / "student_photos"
PHOTOS_DIR = Path(os.environ.get("PHOTOS_DIR", str(_default_photos)))
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()


@router.get("/students")
async def get_students(class_name: Optional[str] = None, year_level: Optional[str] = None,
                       status: Optional[str] = None,
                       user=Depends(get_current_user)):
    query = {"enrolment_status": status if status in ("active", "archived") else "active"}
    if class_name:
        query["class_name"] = class_name
    if year_level:
        query["year_level"] = year_level
    return await db.students.find(query, {"_id": 0}).sort("last_name", 1).to_list(500)


@router.post("/students")
async def create_student(student: Student, user=Depends(get_current_user)):
    d = student.model_dump()
    await db.students.insert_one({**d})
    return d


@router.post("/students/import")
async def import_students(data: dict, user=Depends(get_current_user)):
    rows = data.get("students", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No student data provided")

    imported, updated, errors = [], [], []
    for i, row in enumerate(rows):
        base_role = str(row.get("Base Role") or row.get("base_role") or "Student").strip()
        user_status = str(row.get("User Status") or row.get("user_status") or "Active").strip()
        if base_role.lower() not in ("student", "") or user_status.lower() == "inactive":
            continue

        sussi_id = str(row.get("Import Identifier") or row.get("SussiId") or row.get("sussi_id") or "").strip()
        first_name = str(row.get("First Name") or row.get("first_name") or "").strip()
        preferred_name = str(row.get("Preferred Name") or row.get("preferred_name") or "").strip()
        last_name = str(row.get("Surname") or row.get("last_name") or "").strip()
        class_name = str(row.get("Form Group") or row.get("class_name") or "").strip()
        year_level = str(row.get("Year Level") or row.get("year_level") or "").strip()
        teacher = str(row.get("teacher") or "").strip()
        gender = str(row.get("gender") or "").strip()
        dob = str(row.get("date_of_birth") or "").strip()

        if not sussi_id and not first_name and not last_name:
            errors.append({"row": i + 1, "error": "Missing student identifier"})
            continue

        student_doc = {
            "first_name": first_name or sussi_id, "preferred_name": preferred_name or None,
            "last_name": last_name, "year_level": year_level, "class_name": class_name,
            "teacher": teacher, "gender": gender, "date_of_birth": dob,
            "enrolment_status": "active", "sussi_id": sussi_id, "external_id": sussi_id,
        }

        if sussi_id:
            existing = await db.students.find_one({"sussi_id": sussi_id})
            if existing:
                await db.students.update_one({"sussi_id": sussi_id}, {"$set": student_doc})
                updated.append(sussi_id)
            else:
                student_doc["student_id"] = f"stu_{uuid.uuid4().hex[:8]}"
                await db.students.insert_one({**student_doc})
                imported.append(student_doc)
        else:
            student_doc["student_id"] = f"stu_{uuid.uuid4().hex[:8]}"
            await db.students.insert_one({**student_doc})
            imported.append(student_doc)

    return {"imported": len(imported), "updated": len(updated), "errors": errors, "total": len(rows)}


@router.get("/students/summary")
async def get_students_summary(class_name: Optional[str] = None, year_level: Optional[str] = None,
                                status: Optional[str] = None,
                                user=Depends(get_current_user)):
    query = {"enrolment_status": status if status in ("active", "archived") else "active"}
    if class_name:
        query["class_name"] = class_name
    if year_level:
        query["year_level"] = year_level
    students = await db.students.find(query, {"_id": 0}).sort("last_name", 1).to_list(500)
    student_ids = [s["student_id"] for s in students]

    # Batch fetch everything in parallel — eliminates N+1 queries
    saebrs_map, plus_map, att_map, active_int_docs = await asyncio.gather(
        get_latest_saebrs_bulk(student_ids),
        get_latest_saebrs_plus_bulk(student_ids),
        get_bulk_attendance_stats(student_ids),
        db.interventions.find({"student_id": {"$in": student_ids}, "status": "active"},
                              {"_id": 0, "student_id": 1}).to_list(1000),
    )
    active_int_count: dict = {}
    for intv in active_int_docs:
        sid = intv["student_id"]
        active_int_count[sid] = active_int_count.get(sid, 0) + 1

    result = []
    for s in students:
        sid = s["student_id"]
        saebrs = saebrs_map.get(sid)
        plus = plus_map.get(sid)
        att_pct = att_map.get(sid, {}).get("pct", 100.0)

        if saebrs and plus:
            tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            tier = None

        result.append({
            **s,
            "mtss_tier": tier,
            "saebrs_risk": saebrs["risk_level"] if saebrs else "Not Screened",
            "saebrs_total": saebrs["total_score"] if saebrs else None,
            "wellbeing_tier": plus["wellbeing_tier"] if plus else None,
            "wellbeing_total": plus["wellbeing_total"] if plus else None,
            "attendance_pct": round(att_pct, 1),
            "active_interventions": active_int_count.get(sid, 0),
        })
    return result


@router.get("/students/{student_id}")
async def get_student(student_id: str, user=Depends(get_current_user)):
    s = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return s


@router.get("/students/{student_id}/profile")
async def get_student_profile(student_id: str, user=Depends(get_current_user)):
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    saebrs_results = await db.saebrs_results.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    saebrs_plus = await db.self_report_results.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    interventions = await db.interventions.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    case_notes = await db.case_notes.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(20)
    att_pct = await get_student_attendance_pct(student_id)
    # Use attendance_records (not the old attendance collection)
    attendance_records = await db.attendance_records.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(50)
    alerts = await db.alerts.find({"student_id": student_id, "resolved": False}, {"_id": 0}).to_list(10)

    latest_saebrs = saebrs_results[-1] if saebrs_results else None
    latest_plus = saebrs_plus[-1] if saebrs_plus else None

    if latest_saebrs and latest_plus:
        tier = compute_mtss_tier(latest_saebrs["risk_level"], latest_plus["wellbeing_tier"], att_pct)
    elif latest_saebrs:
        tier = 3 if latest_saebrs["risk_level"] == "High Risk" else (2 if latest_saebrs["risk_level"] == "Some Risk" else 1)
    else:
        tier = None

    return {
        "student": student, "mtss_tier": tier,
        "attendance_pct": round(att_pct, 1),
        "saebrs_results": saebrs_results,
        "self_report_results": saebrs_plus,
        "interventions": interventions,
        "case_notes": case_notes,
        "attendance_records": attendance_records,
        "alerts": alerts
    }


@router.put("/students/{student_id}/external-id")
async def set_student_external_id(student_id: str, data: dict, user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    ext_id = data.get("external_id", "").strip().upper()
    await db.students.update_one({"student_id": student_id}, {"$set": {"external_id": ext_id}})
    return {"message": "External ID updated", "external_id": ext_id}


@router.put("/students/bulk-archive")
async def bulk_archive_students(data: dict, user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    ids = data.get("student_ids", [])
    if not ids:
        raise HTTPException(400, "No student IDs provided")
    result = await db.students.update_many(
        {"student_id": {"$in": ids}},
        {"$set": {"enrolment_status": "archived"}}
    )
    return {"archived": result.modified_count}


@router.put("/students/bulk-reactivate")
async def bulk_reactivate_students(data: dict, user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    ids = data.get("student_ids", [])
    if not ids:
        raise HTTPException(400, "No student IDs provided")
    result = await db.students.update_many(
        {"student_id": {"$in": ids}},
        {"$set": {"enrolment_status": "active"}}
    )
    return {"reactivated": result.modified_count}


@router.put("/students/{student_id}")
async def update_student(student_id: str, data: dict, user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    allowed = ["first_name", "last_name", "preferred_name", "year_level", "class_name", "teacher", "gender", "date_of_birth"]
    update_data = {k: v for k, v in data.items() if k in allowed}
    if not update_data:
        raise HTTPException(400, "No valid fields to update")
    result = await db.students.update_one({"student_id": student_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(404, "Student not found")
    updated = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    return updated


@router.post("/students/{student_id}/photo")
async def upload_single_student_photo(student_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0, "student_id": 1})
    if student is None:
        raise HTTPException(404, "Student not found")
    content = await file.read()
    img = Image.open(io.BytesIO(content))
    img = img.convert("RGB")
    img.thumbnail((400, 400), Image.LANCZOS)
    photo_filename = f"{student_id}.jpg"
    photo_path = PHOTOS_DIR / photo_filename
    img.save(str(photo_path), "JPEG", quality=82, optimize=True)
    photo_url = f"/api/student-photos/{photo_filename}"
    await db.students.update_one({"student_id": student_id}, {"$set": {"photo_url": photo_url}})
    return {"photo_url": photo_url}


@router.delete("/students/{student_id}/photo")
async def remove_student_photo(student_id: str, user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0, "student_id": 1, "photo_url": 1})
    if student is None:
        raise HTTPException(404, "Student not found")
    photo_url = student.get("photo_url")
    if photo_url:
        photo_path = PHOTOS_DIR / Path(photo_url).name
        if photo_path.exists():
            photo_path.unlink()
    await db.students.update_one({"student_id": student_id}, {"$unset": {"photo_url": ""}})
    return {"message": "Photo removed"}


@router.post("/students/upload-photos")
async def upload_student_photos(file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")

    fname_lower = (file.filename or "").lower()
    if not fname_lower.endswith(".zip"):
        raise HTTPException(400, "Please upload a ZIP file")

    content = await file.read()

    matched, unmatched, skipped_staff = [], [], []

    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue

            path_parts = Path(info.filename).parts
            # Skip anything inside a Staff folder
            if any(p.lower().startswith("staff") for p in path_parts):
                skipped_staff.append(info.filename)
                continue

            stem_raw = Path(info.filename).stem
            ext = Path(info.filename).suffix.lower()
            if ext not in (".jpg", ".jpeg", ".png"):
                continue

            # Trim trailing/leading spaces from the full stem
            stem = stem_raw.strip()

            if "," not in stem:
                unmatched.append(stem_raw)
                continue

            # Split on first comma only — handles "Van Den Breul, Emma"
            last_raw, first_raw = stem.split(",", 1)
            last_name = last_raw.strip()
            first_name = first_raw.strip()

            if not last_name or not first_name:
                unmatched.append(stem_raw)
                continue

            # Match 1: legal first name
            student = await db.students.find_one(
                {
                    "last_name": re.compile(f"^{re.escape(last_name)}$", re.IGNORECASE),
                    "first_name": re.compile(f"^{re.escape(first_name)}$", re.IGNORECASE),
                    "enrolment_status": "active",
                },
                {"_id": 0, "student_id": 1},
            )

            # Match 2: preferred name (e.g. "Kettels, Lulu" where legal name is "Lucile")
            if not student:
                student = await db.students.find_one(
                    {
                        "last_name": re.compile(f"^{re.escape(last_name)}$", re.IGNORECASE),
                        "preferred_name": re.compile(f"^{re.escape(first_name)}$", re.IGNORECASE),
                        "enrolment_status": "active",
                    },
                    {"_id": 0, "student_id": 1},
                )

            if not student:
                unmatched.append(f"{last_name}, {first_name}")
                continue

            student_id = student["student_id"]
            save_ext = ".jpg" if ext in (".jpg", ".jpeg") else ".png"
            photo_filename = f"{student_id}{save_ext}"
            photo_path = PHOTOS_DIR / photo_filename

            # Resize and save via Pillow (max 400×400, JPEG quality 82)
            with zf.open(info) as img_bytes:
                img = Image.open(img_bytes)
                img = img.convert("RGB")
                img.thumbnail((400, 400), Image.LANCZOS)
                img.save(str(photo_path), "JPEG", quality=82, optimize=True)

            photo_url = f"/api/student-photos/{photo_filename}"
            await db.students.update_one(
                {"student_id": student_id},
                {"$set": {"photo_url": photo_url}},
            )
            matched.append(f"{last_name}, {first_name}")

    return {
        "matched": len(matched),
        "unmatched": len(unmatched),
        "skipped_staff": len(skipped_staff),
        "unmatched_names": unmatched[:100],
    }


@router.post("/students/import-student-details")
async def import_student_details(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import student demographic details: teacher, gender, EAL, aboriginal status, NCCD."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Admin or leadership access required")

    content = await file.read()
    fname = (file.filename or "").lower()

    if fname.endswith(".csv"):
        text = content.decode("utf-8-sig")
        all_rows = list(csv.reader(io.StringIO(text)))
    elif fname.endswith(".xlsx") or fname.endswith(".xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        all_rows = [[str(cell.value or "").strip() for cell in row] for row in ws.iter_rows()]
    else:
        raise HTTPException(400, "Unsupported file format. Please upload a CSV or XLSX file.")

    if not all_rows:
        raise HTTPException(400, "File is empty.")

    # Find header row — look for STUDENT_KEY
    header_idx, headers = 0, []
    for i, row in enumerate(all_rows[:10]):
        cells = [str(v or "").strip().upper() for v in row]
        if "STUDENT_KEY" in cells:
            header_idx, headers = i, cells
            break
    if not headers:
        raise HTTPException(400, "Could not find STUDENT_KEY column. Check the file format.")

    def _col(*names):
        for n in names:
            for i, h in enumerate(headers):
                if h == n.upper() or h.replace(" ", "_") == n.upper().replace(" ", "_"):
                    return i
        return None

    key_c   = _col("STUDENT_KEY")
    home_c  = _col("HOME_GROUP", "Home Group (teacher)")
    gender_c = _col("GENDER", "Gender")
    eal_c   = _col("EAL_STATUS", "EAL Status")
    atsi_c  = _col("ATSI_STATUS", "Aboriginal Status")
    nccd_c  = _col("NCCD_DISABILITY")

    if key_c is None:
        raise HTTPException(400, "STUDENT_KEY column not found in header row.")

    updated, unmatched, errors = 0, [], []

    for row_num, row in enumerate(all_rows[header_idx + 1:], start=header_idx + 2):
        raw = [str(v or "").strip() for v in row]
        if key_c >= len(raw) or not raw[key_c]:
            continue
        student_key = raw[key_c]

        update = {}
        if home_c is not None and home_c < len(raw) and raw[home_c]:
            hg = raw[home_c]
            m = re.match(r'^(\S+)\s*\(([^)]+)\)\s*$', hg)
            if m:
                update["class_name"] = m.group(1)
                update["teacher"] = m.group(2).title()
            else:
                update["class_name"] = hg

        if gender_c is not None and gender_c < len(raw) and raw[gender_c]:
            update["gender"] = raw[gender_c]
        if eal_c is not None and eal_c < len(raw) and raw[eal_c]:
            update["eal_status"] = raw[eal_c]
        if atsi_c is not None and atsi_c < len(raw) and raw[atsi_c]:
            update["aboriginal_status"] = raw[atsi_c]
        if nccd_c is not None and nccd_c < len(raw) and raw[nccd_c]:
            update["nccd_disability"] = raw[nccd_c]

        if not update:
            continue

        result = await db.students.update_one(
            {"$or": [{"sussi_id": student_key}, {"external_id": student_key}]},
            {"$set": update}
        )
        if result.matched_count > 0:
            updated += 1
        else:
            unmatched.append(student_key)

    return {
        "updated": updated,
        "unmatched": len(unmatched),
        "unmatched_keys": unmatched[:20],
        "errors": errors,
    }
