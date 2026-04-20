import asyncio
from collections import defaultdict
from datetime import date as date_obj
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from database import PRESENT_STATUSES
from deps import get_tenant_db
from helpers import (
    get_current_user, get_school_settings_doc, compute_mtss_tier,
    compute_att_stats,
    get_bulk_attendance_records, get_bulk_attendance_stats,
    get_latest_saebrs_bulk, get_latest_saebrs_plus_bulk, get_all_saebrs_bulk,
)

router = APIRouter()


@router.get("/analytics/tier-distribution")
async def tier_distribution(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    students = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students]

    saebrs_map, plus_map, att_map = await asyncio.gather(
        get_latest_saebrs_bulk(db, student_ids),
        get_latest_saebrs_plus_bulk(db, student_ids),
        get_bulk_attendance_stats(db, student_ids),
    )

    counts = {"tier1": 0, "tier2": 0, "tier3": 0, "unscreened": 0}
    class_breakdown = {}
    for s in students:
        sid = s["student_id"]
        saebrs = saebrs_map.get(sid)
        plus = plus_map.get(sid)
        att_pct = att_map.get(sid, {}).get("pct", 100.0)
        cls = s["class_name"]
        if cls not in class_breakdown:
            class_breakdown[cls] = {"tier1": 0, "tier2": 0, "tier3": 0, "teacher": s.get("teacher", "")}
        if saebrs and plus:
            t = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
            counts[f"tier{t}"] += 1
            class_breakdown[cls][f"tier{t}"] += 1
        elif saebrs:
            t = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
            counts[f"tier{t}"] += 1
            class_breakdown[cls][f"tier{t}"] += 1
        else:
            counts["unscreened"] += 1
    return {"tier_distribution": counts, "total_students": len(students), "class_breakdown": class_breakdown}


@router.get("/analytics/tier-movement")
async def tier_movement(limit: int = 8, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Returns tier distribution at each of the last N screening events over the past year.

    A 'screening event' = any unique calendar date on which at least one SAEBRS or
    SAEBRS-plus result was created. At each event, each student's tier is computed
    from their most-recent SAEBRS + SAEBRS-plus created on/before that date.
    """
    from datetime import datetime, timedelta, timezone
    limit = max(1, min(limit, 20))

    students = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students]
    if not student_ids:
        return {"events": [], "current": {"tier1": 0, "tier2": 0, "tier3": 0, "unscreened": 0, "total": 0}, "previous": None}

    # Full SAEBRS + SAEBRS-plus histories (per student, sorted asc)
    saebrs_hist_map = await get_all_saebrs_bulk(db, student_ids)
    plus_pipeline = [
        {"$match": {"student_id": {"$in": student_ids}}},
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$student_id", "docs": {"$push": "$$ROOT"}}},
    ]
    plus_agg = await db.self_report_results.aggregate(plus_pipeline).to_list(500)
    plus_hist_map = {
        r["_id"]: [{k: v for k, v in d.items() if k != "_id"} for d in r["docs"]]
        for r in plus_agg
    }
    att_map = await get_bulk_attendance_stats(db, student_ids)

    def _to_dt(v):
        if isinstance(v, datetime):
            return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        try:
            dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    # Collect all unique screening dates (past 365 days) across both result types
    now = datetime.now(timezone.utc)
    year_ago = now - timedelta(days=365)
    date_set = set()
    for hist in saebrs_hist_map.values():
        for d in hist:
            cat = _to_dt(d.get("created_at"))
            if cat and cat >= year_ago:
                date_set.add(cat.date())
    for hist in plus_hist_map.values():
        for d in hist:
            cat = _to_dt(d.get("created_at"))
            if cat and cat >= year_ago:
                date_set.add(cat.date())

    event_dates = sorted(date_set)[-limit:]  # oldest-first, keep last N
    # Cutoff = end of that day UTC
    event_cutoffs = [datetime.combine(d, datetime.max.time(), tzinfo=timezone.utc) for d in event_dates]

    # Map each event date → screening_period label (e.g. "Term 2 - P1") if a
    # screening_session exists for that date. Falls back to the formatted date.
    session_rows = await db.screening_sessions.find({}, {"_id": 0, "date": 1, "screening_period": 1}).to_list(500)
    session_period_by_date = {}
    for sess in session_rows:
        d_str = str(sess.get("date") or "")[:10]
        sp = sess.get("screening_period")
        if d_str and sp and d_str not in session_period_by_date:
            session_period_by_date[d_str] = sp

    def _tier_as_of(hist_s, hist_p, att_pct, cutoff):
        s_doc = None
        for d in hist_s:
            cat = _to_dt(d.get("created_at"))
            if cat and cat <= cutoff:
                s_doc = d
            else:
                break
        p_doc = None
        for d in hist_p:
            cat = _to_dt(d.get("created_at"))
            if cat and cat <= cutoff:
                p_doc = d
            else:
                break
        if s_doc and p_doc:
            return compute_mtss_tier(s_doc["risk_level"], p_doc["wellbeing_tier"], att_pct)
        if s_doc:
            rl = s_doc["risk_level"]
            return 3 if rl == "High Risk" else (2 if rl == "Some Risk" else 1)
        return 0

    events = []
    for idx, (ev_date, cutoff) in enumerate(zip(event_dates, event_cutoffs)):
        bucket = {"tier1": 0, "tier2": 0, "tier3": 0, "unscreened": 0}
        for s in students:
            sid = s["student_id"]
            att_pct = att_map.get(sid, {}).get("pct", 100.0)
            t = _tier_as_of(saebrs_hist_map.get(sid, []), plus_hist_map.get(sid, []), att_pct, cutoff)
            if t == 0:
                bucket["unscreened"] += 1
            else:
                bucket[f"tier{t}"] += 1
        events.append({
            "label": session_period_by_date.get(ev_date.isoformat()) or ev_date.strftime("%d %b"),
            "date": ev_date.isoformat(),
            **bucket,
            "total": len(students),
        })

    current = events[-1] if events else {"tier1": 0, "tier2": 0, "tier3": 0, "unscreened": 0, "total": 0}
    previous = events[-2] if len(events) >= 2 else None
    return {"events": events, "current": current, "previous": previous}


@router.get("/analytics/classroom-radar/{class_name}")
async def classroom_radar(class_name: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    students = await db.students.find(
        {"class_name": class_name, "enrolment_status": "active"}, {"_id": 0}
    ).to_list(50)
    student_ids = [s["student_id"] for s in students]

    all_saebrs_map, plus_map, att_map, active_int_docs = await asyncio.gather(
        get_all_saebrs_bulk(db, student_ids),
        get_latest_saebrs_plus_bulk(db, student_ids),
        get_bulk_attendance_stats(db, student_ids),
        db.interventions.find({"student_id": {"$in": student_ids}, "status": "active"}, {"_id": 0}).to_list(200),
    )
    active_int_set = {i["student_id"] for i in active_int_docs}

    result = []
    for s in students:
        sid = s["student_id"]
        all_saebrs = all_saebrs_map.get(sid, [])
        saebrs = all_saebrs[-1] if all_saebrs else None
        plus = plus_map.get(sid)
        att_pct = att_map.get(sid, {}).get("pct", 100.0)
        score_trend = (all_saebrs[-1]["total_score"] - all_saebrs[-2]["total_score"]) if len(all_saebrs) >= 2 else None

        if saebrs and plus:
            tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            tier = 0

        indicators = []
        if plus and plus.get("belonging_domain", 12) <= 4: indicators.append("low_belonging")
        if plus and plus.get("emotional_domain", 9) <= 3: indicators.append("emotional_distress")
        if att_pct < 90: indicators.append("attendance_decline")
        if score_trend is not None and score_trend <= -8: indicators.append("rapid_score_drop")
        if saebrs and saebrs.get("social_risk") != "Low Risk": indicators.append("social_behaviour_risk")
        if saebrs and saebrs.get("academic_risk") != "Low Risk": indicators.append("academic_engagement_risk")

        result.append({
            "student": s, "mtss_tier": tier,
            "saebrs_risk": saebrs["risk_level"] if saebrs else "Not Screened",
            "saebrs_total": saebrs["total_score"] if saebrs else None,
            "social_risk": saebrs["social_risk"] if saebrs else None,
            "academic_risk": saebrs["academic_risk"] if saebrs else None,
            "emotional_risk": saebrs["emotional_risk"] if saebrs else None,
            "wellbeing_tier": plus["wellbeing_tier"] if plus else None,
            "wellbeing_total": plus["wellbeing_total"] if plus else None,
            "belonging_domain": plus["belonging_domain"] if plus else None,
            "emotional_domain": plus["emotional_domain"] if plus else None,
            "attendance_pct": round(att_pct, 1), "score_trend": score_trend,
            "risk_indicators": indicators, "has_active_intervention": sid in active_int_set,
        })
    result.sort(key=lambda x: (-(x["mtss_tier"] or 0), -len(x["risk_indicators"])))
    return result


@router.get("/analytics/school-wide")
async def school_wide(year_level: Optional[str] = None, class_name: Optional[str] = None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    query = {"enrolment_status": "active"}
    if year_level:
        query["year_level"] = year_level
    if class_name:
        query["class_name"] = class_name
    students = await db.students.find(query, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students]

    saebrs_map, plus_map, att_map = await asyncio.gather(
        get_latest_saebrs_bulk(db, student_ids),
        get_latest_saebrs_plus_bulk(db, student_ids),
        get_bulk_attendance_stats(db, student_ids),
    )

    domain_totals = {"social": 0, "academic": 0, "emotional": 0, "belonging": 0, "attendance": 0}
    domain_counts = 0
    tier_by_year: dict = {}
    tier_distribution = {1: 0, 2: 0, 3: 0}
    risk_distribution = {"low": 0, "some": 0, "high": 0}
    domain_risk = {
        "social": {"low": 0, "some": 0, "high": 0},
        "academic": {"low": 0, "some": 0, "high": 0},
        "emotional": {"low": 0, "some": 0, "high": 0},
    }
    class_breakdown: dict = {}
    screened_count = 0

    for s in students:
        sid = s["student_id"]
        yr = s["year_level"]
        cls = s["class_name"]
        if yr not in tier_by_year:
            tier_by_year[yr] = {"tier1": 0, "tier2": 0, "tier3": 0}
        if cls not in class_breakdown:
            class_breakdown[cls] = {"tier1": 0, "tier2": 0, "tier3": 0}

        saebrs = saebrs_map.get(sid)
        plus = plus_map.get(sid)
        att_pct = att_map.get(sid, {}).get("pct", 100.0)

        if saebrs:
            screened_count += 1
            rl = saebrs.get("risk_level", "Low Risk")
            if rl == "High Risk":
                risk_distribution["high"] += 1
            elif rl == "Some Risk":
                risk_distribution["some"] += 1
            else:
                risk_distribution["low"] += 1
            for dim in ["social", "academic", "emotional"]:
                rk = saebrs.get(f"{dim}_risk", "Low Risk")
                if rk == "High Risk":
                    domain_risk[dim]["high"] += 1
                elif rk == "Some Risk":
                    domain_risk[dim]["some"] += 1
                else:
                    domain_risk[dim]["low"] += 1
        if saebrs and plus:
            t = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
            tier_by_year[yr][f"tier{t}"] += 1
            class_breakdown[cls][f"tier{t}"] += 1
            tier_distribution[t] = tier_distribution.get(t, 0) + 1
            domain_totals["social"] += plus["social_domain"]
            domain_totals["academic"] += plus["academic_domain"]
            domain_totals["emotional"] += plus["emotional_domain"]
            domain_totals["belonging"] += plus["belonging_domain"]
            domain_totals["attendance"] += plus.get("attendance_domain", 0)
            domain_counts += 1

    domain_avgs = {k: round(v / domain_counts, 1) if domain_counts > 0 else 0 for k, v in domain_totals.items()}
    total = len(students)
    return {
        "tier_by_year": tier_by_year, "tier_distribution": tier_distribution,
        "risk_distribution": risk_distribution, "domain_risk": domain_risk,
        "class_breakdown": class_breakdown,
        "domain_averages": domain_avgs, "total_students": total,
        "screened_students": screened_count,
        "screening_rate": round(screened_count / total * 100) if total > 0 else 0,
    }


@router.get("/analytics/cohort-comparison")
async def cohort_comparison(group_by: str = "year_level", user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if group_by not in ("year_level", "class_name"):
        raise HTTPException(400, "group_by must be 'year_level' or 'class_name'")
    students = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students]

    saebrs_map, plus_map, att_map = await asyncio.gather(
        get_latest_saebrs_bulk(db, student_ids),
        get_latest_saebrs_plus_bulk(db, student_ids),
        get_bulk_attendance_stats(db, student_ids),
    )

    cohorts: dict = {}
    for s in students:
        key = s.get(group_by) or "Unknown"
        if key not in cohorts:
            cohorts[key] = {"name": key, "total": 0, "screened": 0,
                            "tier1": 0, "tier2": 0, "tier3": 0,
                            "risk_low": 0, "risk_some": 0, "risk_high": 0, "att_sum": 0.0}
        cohorts[key]["total"] += 1
        sid = s["student_id"]
        saebrs = saebrs_map.get(sid)
        plus = plus_map.get(sid)
        att_pct = att_map.get(sid, {}).get("pct", 100.0)
        cohorts[key]["att_sum"] += att_pct
        if saebrs:
            cohorts[key]["screened"] += 1
            rl = saebrs.get("risk_level", "Low Risk")
            if rl == "High Risk":
                cohorts[key]["risk_high"] += 1
            elif rl == "Some Risk":
                cohorts[key]["risk_some"] += 1
            else:
                cohorts[key]["risk_low"] += 1
        if saebrs and plus:
            t = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            t = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            t = None
        if t:
            cohorts[key][f"tier{t}"] += 1

    result = []
    for k, d in sorted(cohorts.items()):
        avg_att = round(d["att_sum"] / d["total"], 1) if d["total"] > 0 else 0
        result.append({"name": d["name"], "total": d["total"], "screened": d["screened"],
                       "tier1": d["tier1"], "tier2": d["tier2"], "tier3": d["tier3"],
                       "risk_low": d["risk_low"], "risk_some": d["risk_some"], "risk_high": d["risk_high"],
                       "avg_attendance": avg_att})
    return result


@router.get("/analytics/intervention-outcomes")
async def intervention_outcomes(year_level: Optional[str] = None, class_name: Optional[str] = None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if year_level or class_name:
        sq = {"enrolment_status": "active"}
        if year_level:
            sq["year_level"] = year_level
        if class_name:
            sq["class_name"] = class_name
        ss = await db.students.find(sq, {"_id": 0, "student_id": 1}).to_list(500)
        sids = [s["student_id"] for s in ss]
        interventions = await db.interventions.find({"student_id": {"$in": sids}}, {"_id": 0}).to_list(500)
    else:
        interventions = await db.interventions.find({}, {"_id": 0}).to_list(500)
    by_type: dict = {}
    for i in interventions:
        t = i["intervention_type"]
        if t not in by_type:
            by_type[t] = {"total": 0, "completed": 0, "active": 0, "ratings": []}
        by_type[t]["total"] += 1
        if i["status"] == "completed":
            by_type[t]["completed"] += 1
            if i.get("outcome_rating"):
                by_type[t]["ratings"].append(i["outcome_rating"])
        elif i["status"] == "active":
            by_type[t]["active"] += 1
    return [{"type": t, "total": d["total"], "completed": d["completed"], "active": d["active"],
             "completion_rate": round(d["completed"] / d["total"] * 100) if d["total"] > 0 else 0,
             "avg_rating": round(sum(d["ratings"]) / len(d["ratings"]), 1) if d["ratings"] else None}
            for t, d in by_type.items()]


@router.get("/analytics/attendance-trends")
async def attendance_trends(year_level: Optional[str] = None, class_name: Optional[str] = None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    student_query = {"enrolment_status": "active"}
    if year_level:
        student_query["year_level"] = year_level
    if class_name:
        student_query["class_name"] = class_name
    students = await db.students.find(student_query, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students]
    num_students = len(students)

    settings_doc, records_by_student = await asyncio.gather(
        get_school_settings_doc(db),
        get_bulk_attendance_records(db, student_ids),
    )
    year = settings_doc.get("current_year")
    today_str = date_obj.today().isoformat()
    year_filter = {"year": year, "date": {"$lte": today_str}} if year else {"date": {"$lte": today_str}}
    school_days_list = await db.school_days.distinct("date", year_filter)
    excluded_types = set(settings_doc.get("excluded_absence_types", []))

    days_by_month: dict = defaultdict(int)
    days_by_dow: dict = defaultdict(int)
    for day in school_days_list:
        days_by_month[day[:7]] += 1
        try:
            days_by_dow[date_obj.fromisoformat(day).weekday()] += 1
        except Exception:
            pass

    monthly_absent: dict = defaultdict(int)
    monthly_excluded: dict = defaultdict(int)
    dow_absent: dict = defaultdict(int)
    dow_excluded: dict = defaultdict(int)
    chronic_absentees = []

    for s in students:
        sid = s["student_id"]
        recs = records_by_student.get(sid, [])
        exc_by_date = {r["date"]: r for r in recs}
        stats = compute_att_stats(school_days_list, exc_by_date, excluded_types)
        att_pct = stats["pct"]

        if att_pct < 90:
            chronic_absentees.append({"student": s, "attendance_pct": round(att_pct, 1),
                                      "tier": 3 if att_pct < 80 else 2})
        for r in recs:
            month = r.get("date", "")[:7]
            try:
                dow = date_obj.fromisoformat(r.get("date", "")).weekday()
            except Exception:
                dow = None
            for sv in [r.get("am_status", ""), r.get("pm_status", "")]:
                sv = (sv or "").strip()
                if not sv:
                    continue
                if sv in excluded_types:
                    if month:
                        monthly_excluded[month] += 1
                    if dow is not None:
                        dow_excluded[dow] += 1
                elif sv not in PRESENT_STATUSES:
                    if month:
                        monthly_absent[month] += 1
                    if dow is not None:
                        dow_absent[dow] += 1

    monthly_trend = []
    for month in sorted(days_by_month.keys()):
        total = days_by_month[month] * 2 * num_students - monthly_excluded.get(month, 0)
        absent = monthly_absent.get(month, 0)
        att_rate = round((total - absent) / total * 100, 1) if total > 0 else 100.0
        monthly_trend.append({"month": month, "attendance_rate": att_rate})

    DOW_NAMES = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}
    dow_trend = []
    for dow in range(5):
        if days_by_dow.get(dow, 0) == 0:
            continue
        total = days_by_dow[dow] * 2 * num_students - dow_excluded.get(dow, 0)
        absent = dow_absent.get(dow, 0)
        att_rate = round((total - absent) / total * 100, 1) if total > 0 else 100.0
        dow_trend.append({"day": DOW_NAMES[dow], "attendance_rate": att_rate})

    chronic_absentees.sort(key=lambda x: x["attendance_pct"])
    return {
        "monthly_trend": monthly_trend, "day_of_week": dow_trend,
        "chronic_absentees": chronic_absentees[:20], "total_school_days": len(school_days_list),
    }


@router.get("/meeting-prep")
async def meeting_prep(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    students = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    student_ids = [s["student_id"] for s in students]

    all_saebrs_map, plus_map, att_map, active_int_docs = await asyncio.gather(
        get_all_saebrs_bulk(db, student_ids),
        get_latest_saebrs_plus_bulk(db, student_ids),
        get_bulk_attendance_stats(db, student_ids),
        db.interventions.find({"student_id": {"$in": student_ids}, "status": "active"}, {"_id": 0}).to_list(1000),
    )
    interventions_by_student: dict = defaultdict(list)
    for intv in active_int_docs:
        interventions_by_student[intv["student_id"]].append(intv)

    result = []
    tier_changes = []

    for s in students:
        sid = s["student_id"]
        all_saebrs = all_saebrs_map.get(sid, [])
        saebrs = all_saebrs[-1] if all_saebrs else None
        prev_saebrs = all_saebrs[-2] if len(all_saebrs) >= 2 else None
        plus = plus_map.get(sid)
        att_pct = att_map.get(sid, {}).get("pct", 100.0)

        if saebrs and plus:
            tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            continue

        if prev_saebrs:
            prev_tier = 3 if prev_saebrs["risk_level"] == "High Risk" else (2 if prev_saebrs["risk_level"] == "Some Risk" else 1)
            if prev_tier != tier:
                tier_changes.append({
                    "student": s, "previous_tier": prev_tier, "current_tier": tier,
                    "direction": "improved" if tier < prev_tier else "declined",
                    "previous_screening": prev_saebrs.get("created_at", ""),
                    "current_screening": saebrs.get("created_at", ""),
                    "saebrs": saebrs,
                })

        if tier >= 2:
            result.append({
                "student": s, "mtss_tier": tier, "saebrs": saebrs, "saebrs_plus": plus,
                "active_interventions": interventions_by_student.get(sid, []),
                "attendance_pct": round(att_pct, 1),
            })

    result.sort(key=lambda x: -x["mtss_tier"])
    return {"students": result, "tier_changes": tier_changes}
