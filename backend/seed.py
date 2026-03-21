"""
seed.py — Demo data generator for WellTrack.
Called by POST /api/settings/seed
"""
import uuid, random
from datetime import timedelta, date as date_type

from database import db
from helpers import (compute_saebrs_risk, compute_wellbeing_tier,
                     compute_attendance_score, compute_mtss_tier)


async def seed_database(student_count: int = 32):
    student_count = max(8, min(400, student_count))

    for col in ["students", "attendance", "attendance_records", "school_days", "screening_sessions",
                "saebrs_results", "saebrs_plus_results", "interventions", "case_notes", "alerts"]:
        await db[col].delete_many({})

    await db.school_settings.update_one({}, {"$set": {
        "excluded_absence_types": ["Camp", "Excursion", "School Event"],
    }}, upsert=True)
    # NOTE: school_name, school_type, current_term, current_year are NOT reset here
    # so that onboarding values are preserved when user chooses "Load Demo Data"

    rng = random.Random(42)

    classes_data = [
        {"class": "3A", "teacher": "Ms Thompson", "year": "Year 3"},
        {"class": "5B", "teacher": "Mr Rodriguez", "year": "Year 5"},
        {"class": "7C", "teacher": "Ms Chen", "year": "Year 7"},
        {"class": "9A", "teacher": "Mr Williams", "year": "Year 9"},
    ]
    # Distribute student_count evenly across 4 classes; first (student_count % 4) classes get one extra
    base_per_class = student_count // 4
    extra_classes = student_count % 4
    class_sizes = [base_per_class + (1 if i < extra_classes else 0) for i in range(len(classes_data))]

    first_names = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
                   "Isabella", "James", "Charlotte", "Alexander", "Amelia", "William", "Harper",
                   "Benjamin", "Evelyn", "Lucas", "Abigail", "Henry", "Emily", "Sebastian",
                   "Elizabeth", "Jack", "Sofia", "Owen", "Avery", "Theodore", "Ella", "Carter",
                   "Scarlett", "Jayden"]
    preferred_names = [None, None, None, "Ollie", None, None, None, None,
                       "Izzy", None, None, "Alex", None, "Will", None,
                       "Ben", None, None, "Abby", "Hank", None, "Seb",
                       "Liz", None, None, None, None, "Theo", None, None,
                       None, "Jay"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
                  "Wilson", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin",
                  "Thompson", "Moore", "Young", "Lee", "Walker", "Allen", "Hall", "Nguyen",
                  "Robinson", "King", "Wright", "Scott", "Torres", "Green"]

    students = []
    name_idx = 0
    for cls_idx, cls_data in enumerate(classes_data):
        for i in range(class_sizes[cls_idx]):
            fname = first_names[name_idx % len(first_names)]
            pname = preferred_names[name_idx % len(preferred_names)]
            lname = last_names[(name_idx + 7) % len(last_names)]
            sussi = f"YUS{name_idx + 1:04d}"
            students.append({
                "student_id": f"stu_{uuid.uuid4().hex[:8]}",
                "first_name": fname, "preferred_name": pname, "last_name": lname,
                "year_level": cls_data["year"], "class_name": cls_data["class"],
                "teacher": cls_data["teacher"],
                "date_of_birth": "2014-01-01", "gender": "Male" if name_idx % 2 == 0 else "Female",
                "enrolment_status": "active",
                "sussi_id": sussi, "external_id": sussi,
            })
            name_idx += 1

    await db.students.insert_many(students)

    await db.screening_sessions.insert_many([
        {"screening_id": "scr_term1_2025", "screening_period": "Term 1", "year": 2025,
         "date": "2025-02-15", "teacher_id": "demo", "class_name": "all", "status": "completed"},
        {"screening_id": "scr_term2_2025", "screening_period": "Term 2", "year": 2025,
         "date": "2025-05-10", "teacher_id": "demo", "class_name": "all", "status": "completed"},
    ])

    def build_school_days(start_date, num_days):
        days = []
        d = start_date
        while len(days) < num_days:
            if d.weekday() < 5:
                days.append(d.isoformat())
            d += timedelta(days=1)
        return days

    term1_days = build_school_days(date_type(2025, 2, 3), 30)
    term2_days = build_school_days(date_type(2025, 4, 28), 25)
    all_school_days = term1_days + term2_days

    low_s = [3, 3, 3, 2, 3, 3]; low_a = [3, 3, 2, 3, 2, 3]; low_e = [3, 3, 3, 3, 2, 3, 3]
    some_s = [2, 2, 2, 2, 1, 2]; some_a = [2, 2, 1, 2, 1, 2]; some_e = [2, 2, 2, 1, 2, 2, 2]
    high_s = [1, 0, 1, 1, 0, 1]; high_a = [0, 1, 0, 1, 0, 0]; high_e = [1, 0, 0, 1, 0, 1, 0]
    sr_low = [0, 3, 3, 3, 3, 3, 3]; sr_some = [2, 2, 2, 2, 2, 2, 2]; sr_high = [3, 0, 1, 0, 1, 0, 1]

    att_map = {
        "low":  [97, 98, 96, 99],
        "some": [91, 92, 93, 94],
        "high": [72, 68, 82, 75],
    }

    risk_overrides = {
        3: ("some", "high"),
        7: ("high", "some"),
        11: ("low", "some"),
        15: ("some", "low"),
    }
    risk_cycle = ["low", "low", "low", "some", "some", "some", "high", "high"]

    def vary(items, delta=1):
        return [max(0, min(3, x + rng.randint(-delta, delta))) for x in items]

    regular_absences = [
        "Medical/Illness", "Medical/Illness", "Medical/Illness",
        "Unexplained", "Unexplained",
        "Family Holiday",
        "School refusal or school can't",
        "Parental choice",
        "Late arrival, approved",
        "Late arrival at School",
    ]
    neutral_absences = ["Camp", "Excursion", "School Event"]

    case_note_templates = {
        3: [
            ("wellbeing", "Wellbeing check-in. Student reported feeling overwhelmed and anxious about upcoming assessments. Discussed breathing techniques and time management strategies. Will follow up next week."),
            ("behaviour", "Incident report: Student became distressed during group work and left the classroom. Spoke with student after — they shared they are struggling at home. Referred to school counsellor."),
            ("general",   "Follow-up meeting with parent/guardian. Family aware of school concerns. Parent noted similar behaviours at home. Collaborative support plan being drafted. Counsellor to lead."),
        ],
        2: [
            ("general",   "Regular check-in. Student appears to be managing but showing early signs of disengagement. Monitoring closely and checking in weekly. Encouraged to use check-in card."),
            ("wellbeing", "Student self-referred to discuss friendship difficulties. Provided social skills strategies. Will observe in unstructured times and check in again next week."),
        ],
    }

    all_s1, all_s2, all_p1, all_p2 = [], [], [], []
    all_att_recs, all_int, all_notes, all_alerts = [], [], [], []
    school_days_set = set(all_school_days)

    for idx, student in enumerate(students):
        sid = student["student_id"]
        base_risk = risk_cycle[idx % len(risk_cycle)]

        if idx in risk_overrides:
            risk_t1, risk_t2 = risk_overrides[idx]
        else:
            risk_t1 = risk_t2 = base_risk

        att_frac = rng.choice(att_map[base_risk]) / 100.0
        pref = student.get('preferred_name')
        first = student['first_name']
        display = f"{first}{(' (' + pref + ')') if pref and pref != first else ''} {student['last_name']}"

        def prof(risk):
            if risk == "low":   return low_s, low_a, low_e, sr_low
            if risk == "some":  return some_s, some_a, some_e, sr_some
            return high_s, high_a, high_e, sr_high

        s_t1, a_t1, e_t1, sr_t1 = prof(risk_t1)
        s_t2, a_t2, e_t2, sr_t2 = prof(risk_t2)

        def make_saebrs(s_items, a_items, e_items, screening_id, ts):
            s = sum(s_items); a = sum(a_items); e = sum(e_items); t = s + a + e
            r, sr, ar, er = compute_saebrs_risk(t, s, a, e)
            return {"result_id": str(uuid.uuid4()), "student_id": sid, "screening_id": screening_id,
                    "social_items": s_items, "academic_items": a_items, "emotional_items": e_items,
                    "social_score": s, "academic_score": a, "emotional_score": e, "total_score": t,
                    "risk_level": r, "social_risk": sr, "academic_risk": ar, "emotional_risk": er,
                    "created_at": ts}

        def make_plus(saebrs_doc, sr_items, screening_id, att, ts):
            soc = saebrs_doc["social_score"]; aca = saebrs_doc["academic_score"]
            rev = 3 - sr_items[0]
            emo = rev + sr_items[1] + sr_items[2]
            bel = sr_items[3] + sr_items[4] + sr_items[5] + sr_items[6]
            att_s = compute_attendance_score(att * 100)
            att_d = att_s * 3
            total = soc + aca + emo + bel + att_d
            return {"result_id": str(uuid.uuid4()), "student_id": sid, "screening_id": screening_id,
                    "self_report_items": sr_items, "attendance_pct": att * 100,
                    "social_domain": soc, "academic_domain": aca, "emotional_domain": emo,
                    "belonging_domain": bel, "attendance_domain": att_d,
                    "wellbeing_total": total, "wellbeing_tier": compute_wellbeing_tier(total),
                    "created_at": ts}

        s1 = make_saebrs(vary(s_t1), vary(a_t1), vary(e_t1), "scr_term1_2025", "2025-02-15T09:00:00")
        s2 = make_saebrs(vary(s_t2, 2), vary(a_t2, 2), vary(e_t2, 2), "scr_term2_2025", "2025-05-10T09:00:00")
        all_s1.append(s1); all_s2.append(s2)

        p1 = make_plus(s1, vary(sr_t1), "scr_term1_2025", att_frac, "2025-02-15T10:00:00")
        p2 = make_plus(s2, vary(sr_t2, 2), "scr_term2_2025", att_frac, "2025-05-10T10:00:00")
        all_p1.append(p1); all_p2.append(p2)

        total_days = len(all_school_days)
        absent_days_count = int(total_days * (1 - att_frac))
        absent_indices = set(rng.sample(range(total_days), min(absent_days_count, total_days)))

        neutral_indices = set()
        if base_risk == "low" and total_days > 5:
            neutral_indices = set(rng.sample(range(total_days), rng.randint(1, 3)))

        for day_num, rec_date in enumerate(all_school_days):
            if day_num in neutral_indices:
                ntype = rng.choice(neutral_absences)
                all_att_recs.append({
                    "student_id": sid, "external_id": student.get("sussi_id", ""),
                    "date": rec_date, "am_status": ntype, "pm_status": ntype
                })
            elif day_num in absent_indices:
                abs_type = rng.choice(regular_absences)
                if rng.random() < 0.20 and abs_type in ("Late arrival, approved", "Late arrival at School"):
                    all_att_recs.append({
                        "student_id": sid, "external_id": student.get("sussi_id", ""),
                        "date": rec_date, "am_status": abs_type, "pm_status": "Present"
                    })
                else:
                    all_att_recs.append({
                        "student_id": sid, "external_id": student.get("sussi_id", ""),
                        "date": rec_date, "am_status": abs_type, "pm_status": abs_type
                    })

        final_tier = compute_mtss_tier(s2["risk_level"], p2["wellbeing_tier"], att_frac * 100)
        prev_tier = compute_mtss_tier(s1["risk_level"], p1["wellbeing_tier"], att_frac * 100)

        if s2["risk_level"] == "High Risk":
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "early_warning", "alert_type": "high_risk_saebrs", "severity": "high",
                "message": f"{display} screened High Risk (SAEBRS: {s2['total_score']}/57)",
                "created_at": "2025-05-10T09:30:00", "is_read": False, "resolved": False, "status": "pending"
            })

        if att_frac * 100 < 80:
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "early_warning", "alert_type": "low_attendance_80", "severity": "high",
                "message": f"{display} critically low attendance ({att_frac * 100:.0f}%)",
                "created_at": "2025-05-01T08:00:00", "is_read": False, "resolved": False, "status": "pending"
            })
        elif att_frac * 100 < 90:
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "early_warning", "alert_type": "low_attendance_90", "severity": "medium",
                "message": f"{display} attendance below 90% ({att_frac * 100:.0f}%)",
                "created_at": "2025-05-01T08:00:00", "is_read": False, "resolved": False, "status": "pending"
            })

        if prev_tier != final_tier:
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "tier_change", "alert_type": "tier_change",
                "from_tier": prev_tier, "to_tier": final_tier,
                "severity": "high" if final_tier > prev_tier else "medium",
                "message": f"{display} moved from Tier {prev_tier} to Tier {final_tier}",
                "created_at": "2025-05-10T09:30:00", "is_read": False, "resolved": False, "status": "pending"
            })

        staff_options = ["Ms Parker (Wellbeing)", "Mr Lewis (Counsellor)", "Ms Ahmed (SENCO)", student["teacher"]]
        int_types_t3 = ["Counselling", "Behaviour Support", "Social Skills Groups", "Check-In/Check-Out"]
        int_types_t2 = ["Mentoring", "Academic Support", "Attendance Intervention", "Parent Consultation"]

        if final_tier == 3:
            all_int.append({
                "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "intervention_type": rng.choice(int_types_t3), "assigned_staff": rng.choice(staff_options[:3]),
                "start_date": "2025-04-28", "review_date": "2025-06-09", "status": "active",
                "goals": "Reduce risk indicators, build coping strategies and improve school connectedness.",
                "progress_notes": "Initial engagement established. Student is attending sessions. Monitoring weekly progress.",
                "frequency": "3x weekly", "outcome_rating": None, "created_at": "2025-04-28T09:00:00"
            })
            all_int.append({
                "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "intervention_type": rng.choice(int_types_t3), "assigned_staff": rng.choice(staff_options[:3]),
                "start_date": "2025-02-03", "review_date": "2025-03-28", "status": "completed",
                "goals": "Establish rapport and identify key risk factors.",
                "progress_notes": "Completed 8-week programme. Student showed moderate improvement in social engagement.",
                "frequency": "Weekly", "outcome_rating": rng.choice([3, 4, 4]), "created_at": "2025-02-03T09:00:00"
            })
            for tmpl_idx, (ntype, ntext) in enumerate(case_note_templates.get(3, [])):
                note_dates = ["2025-03-10", "2025-04-14", "2025-05-12"]
                all_notes.append({
                    "case_id": f"case_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "staff_member": rng.choice(["Ms Parker (Wellbeing)", student["teacher"], "Mr Lewis (Counsellor)"]),
                    "date": note_dates[tmpl_idx % len(note_dates)], "note_type": ntype, "notes": ntext,
                    "created_at": f"2025-0{3 + tmpl_idx}-10T11:00:00"
                })

        elif final_tier == 2:
            all_int.append({
                "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "intervention_type": rng.choice(int_types_t2), "assigned_staff": rng.choice(staff_options),
                "start_date": "2025-04-28", "review_date": "2025-06-09", "status": "active",
                "goals": "Monitor emerging risk factors and build protective factors through regular check-ins.",
                "progress_notes": "Weekly check-ins established. Student is receptive to support.",
                "frequency": "Weekly", "outcome_rating": None, "created_at": "2025-04-28T09:00:00"
            })
            if rng.random() < 0.5:
                all_int.append({
                    "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "intervention_type": rng.choice(int_types_t2), "assigned_staff": rng.choice(staff_options),
                    "start_date": "2025-02-17", "review_date": "2025-03-28", "status": "completed",
                    "goals": "Early monitoring and prevention of further risk escalation.",
                    "progress_notes": "6-week monitoring programme complete. No escalation observed.",
                    "frequency": "Fortnightly", "outcome_rating": rng.choice([3, 4, 5]), "created_at": "2025-02-17T09:00:00"
                })
            for tmpl_idx, (ntype, ntext) in enumerate(case_note_templates.get(2, [])):
                note_dates = ["2025-04-07", "2025-05-08"]
                all_notes.append({
                    "case_id": f"case_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "staff_member": rng.choice([student["teacher"], "Ms Parker (Wellbeing)"]),
                    "date": note_dates[tmpl_idx % len(note_dates)], "note_type": ntype, "notes": ntext,
                    "created_at": f"2025-0{4 + tmpl_idx}-07T09:30:00"
                })

    # Insert demo school days by default; override with term-based days if terms are defined
    await db.school_days.insert_many([{"date": d} for d in sorted(school_days_set)])
    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    terms = (settings_doc or {}).get("terms", [])
    if terms:
        # Re-apply term-based school days so the Calendar settings are not overwritten by seed
        from datetime import date as _dt, timedelta as _td
        excluded = {d["date"] for d in (settings_doc or {}).get("non_school_days", [])}
        term_days = set()
        for t in terms:
            try:
                start = _dt.fromisoformat(t["start_date"])
                end   = _dt.fromisoformat(t["end_date"])
            except Exception:
                continue
            cur = start
            while cur <= end:
                if cur.weekday() < 5 and cur.isoformat() not in excluded:
                    term_days.add(cur.isoformat())
                cur += _td(days=1)
        await db.school_days.delete_many({})
        if term_days:
            await db.school_days.insert_many([{"date": d} for d in sorted(term_days)])

    for col_data, col_name in [
        (all_s1 + all_s2, "saebrs_results"),
        (all_p1 + all_p2, "saebrs_plus_results"),
        (all_att_recs,    "attendance_records"),
        (all_int,         "interventions"),
        (all_notes,       "case_notes"),
        (all_alerts,      "alerts"),
    ]:
        if col_data:
            await db[col_name].insert_many(col_data)

    return {
        "message": "Demo data seeded",
        "students": len(students),
        "school_days": len(school_days_set),
        "attendance_records": len(all_att_recs),
        "interventions": len(all_int),
        "case_notes": len(all_notes),
        "alerts": len(all_alerts),
    }
