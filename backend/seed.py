"""
seed.py — Demo data generator for WellTrack.
Called by POST /api/settings/seed
"""
import uuid, random
from datetime import timedelta, date as date_type

from helpers import (compute_saebrs_risk, compute_wellbeing_tier,
                     compute_attendance_score, compute_mtss_tier)


async def seed_database(db, student_count: int = 32):
    student_count = max(8, min(2000, student_count))

    for col in ["students", "attendance", "attendance_records", "school_days", "screening_sessions",
                "saebrs_results", "self_report_results", "interventions", "case_notes", "alerts",
                "appointments"]:
        await db[col].delete_many({})

    await db.school_settings.update_one({}, {"$set": {
        "excluded_absence_types": ["Camp", "Excursion", "School Event"],
    }}, upsert=True)

    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    seed_year = (settings_doc or {}).get("current_year") or date_type.today().year

    rng = random.Random(42)

    # ── Build classes dynamically (max 25 per class) ─────────────────────────
    base_classes = [
        {"prefix": "F/1", "year": "Foundation", "teachers": ["Ms Patel", "Ms Chen", "Mr Brooks"]},
        {"prefix": "1/2", "year": "Year 1",     "teachers": ["Ms Lee", "Ms Adams", "Mr Wright"]},
        {"prefix": "3",   "year": "Year 3",     "teachers": ["Ms Thompson", "Ms Gray", "Mr Hall"]},
        {"prefix": "5",   "year": "Year 5",     "teachers": ["Mr Rodriguez", "Ms Evans", "Mr King"]},
    ]
    MAX_PER_CLASS = 25
    classes_data = []
    students_per_group = student_count // len(base_classes)
    remainder = student_count % len(base_classes)

    for grp_idx, grp in enumerate(base_classes):
        grp_size = students_per_group + (1 if grp_idx < remainder else 0)
        num_classes = max(1, (grp_size + MAX_PER_CLASS - 1) // MAX_PER_CLASS)
        per_class = grp_size // num_classes
        extra = grp_size % num_classes
        for c in range(num_classes):
            suffix = chr(ord('A') + c)
            size = per_class + (1 if c < extra else 0)
            teacher = grp["teachers"][c % len(grp["teachers"])]
            classes_data.append({
                "class": f"{grp['prefix']}{suffix}",
                "teacher": teacher,
                "year": grp["year"],
                "size": size,
            })

    first_names = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
                   "Isabella", "James", "Charlotte", "Alexander", "Amelia", "William", "Harper",
                   "Benjamin", "Evelyn", "Lucas", "Abigail", "Henry", "Emily", "Sebastian",
                   "Elizabeth", "Jack", "Sofia", "Owen", "Avery", "Theodore", "Ella", "Carter",
                   "Scarlett", "Jayden", "Mia", "Logan", "Aria", "Aiden", "Chloe", "Daniel",
                   "Riley", "Jackson", "Lily", "Caleb", "Zoe", "Matthew", "Layla", "Ryan",
                   "Grace", "Nathan", "Hannah", "Leo"]
    preferred_names = {3: "Ollie", 8: "Izzy", 11: "Alex", 13: "Will", 15: "Ben",
                       18: "Abby", 19: "Hank", 21: "Seb", 22: "Liz", 27: "Theo", 31: "Jay"}
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
                  "Wilson", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin",
                  "Thompson", "Moore", "Young", "Lee", "Walker", "Allen", "Hall", "Nguyen",
                  "Robinson", "King", "Wright", "Scott", "Torres", "Green", "Baker", "Hill",
                  "Adams", "Nelson", "Carter", "Mitchell", "Roberts", "Campbell", "Phillips", "Evans"]

    # ── Tier distribution: ~15% T3, ~30% T2, ~55% T1 (with variance) ────────
    target_t3_pct = rng.uniform(0.10, 0.15)
    target_t2_pct = rng.uniform(0.25, 0.30)
    t3_count = int(student_count * target_t3_pct)
    t2_count = int(student_count * target_t2_pct)
    t1_count = student_count - t3_count - t2_count

    risk_assignments = ["high"] * t3_count + ["some"] * t2_count + ["low"] * t1_count
    rng.shuffle(risk_assignments)

    students = []
    name_idx = 0
    for cls_data in classes_data:
        for i in range(cls_data["size"]):
            fname = first_names[name_idx % len(first_names)]
            pname = preferred_names.get(name_idx % len(first_names))
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

    # ── Build 8 screening events spaced over the past year ──────────────────
    # We go backwards from ~2 weeks ago at ~7-week intervals so the Tier Movement
    # chart shows a full year of data. The 2 most-recent events are the "current"
    # snapshot used by alert/intervention logic (preserved as s1/s2).
    today = date_type.today()
    most_recent = today - timedelta(days=14)
    # 8 events, evenly spaced ~45 days apart; oldest → newest
    event_gaps_days = [45 * i for i in range(8)]
    event_dates = sorted([most_recent - timedelta(days=g) for g in event_gaps_days])

    # Label each with a Term/Period marker based on Australian term calendar
    def _term_period_label(d):
        # Terms: 1=Jan-early-Apr, 2=late-Apr-Jul, 3=Jul-Sep, 4=Oct-Dec
        m = d.month
        term = 1 if m <= 4 else (2 if m <= 7 else (3 if m <= 9 else 4))
        # Period 1 = first half of term, Period 2 = second half
        period = 1 if d.day <= 15 else 2
        return term, period, f"Term {term} - P{period}"

    screening_sessions = []
    for idx, ev_date in enumerate(event_dates):
        term, period, label = _term_period_label(ev_date)
        screening_sessions.append({
            "screening_id": f"scr_{ev_date.isoformat()}",
            "screening_period": label,
            "year": ev_date.year,
            "date": ev_date.isoformat(),
            "teacher_id": "demo",
            "class_name": "all",
            "status": "completed",
        })
    await db.screening_sessions.insert_many(screening_sessions)

    # ── Build ~220 school days spanning the past 365 days ───────────────────
    # Australian school calendar: 4 terms × ~10 weeks = ~200 school days,
    # separated by 4 holiday windows (~2 weeks each).
    #   Term 1:  late Jan  → early April
    #   Term 2:  late April → early July
    #   Term 3:  mid July   → late September
    #   Term 4:  early October → mid December
    def _in_school_holiday(d):
        md = (d.month, d.day)
        return (
            md >= (12, 18) or md <= (1, 27) or       # Summer (Dec-Jan)
            (4, 3) <= md <= (4, 22) or               # Easter / T1-T2 break
            (7, 4) <= md <= (7, 19) or               # T2-T3 break (winter)
            (9, 26) <= md <= (10, 9)                 # T3-T4 break (spring)
        )

    year_ago = most_recent - timedelta(days=365)
    all_school_days = []
    d = year_ago
    while d <= most_recent:
        if d.weekday() < 5 and not _in_school_holiday(d):
            all_school_days.append(d.isoformat())
        d += timedelta(days=1)

    low_s = [3, 3, 3, 2, 3, 3]; low_a = [3, 3, 2, 3, 2, 3]; low_e = [3, 3, 3, 3, 2, 3, 3]
    some_s = [2, 2, 2, 2, 1, 2]; some_a = [2, 2, 1, 2, 1, 2]; some_e = [2, 2, 2, 1, 2, 2, 2]
    high_s = [1, 0, 1, 1, 0, 1]; high_a = [0, 1, 0, 1, 0, 0]; high_e = [1, 0, 0, 1, 0, 1, 0]
    sr_low = [0, 3, 3, 3, 3, 3, 3]; sr_some = [2, 2, 2, 2, 2, 2, 2]; sr_high = [3, 0, 1, 0, 1, 0, 1]

    att_map = {
        "low":  [97, 98, 96, 99],
        "some": [91, 92, 93, 94],
        "high": [72, 68, 82, 75],
    }

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

    # ── Appointment templates ────────────────────────────────────────────────
    apt_types = ["Individual Counselling", "Wellbeing Check-In", "Parent Meeting",
                 "SSG Meeting", "Behaviour Review", "Academic Support"]
    apt_rooms = ["Wellbeing Room", "Meeting Room 1", "Counsellor Office", "Staff Room"]
    apt_staff = ["Ms Parker (Wellbeing)", "Mr Lewis (Counsellor)", "Ms Ahmed (SENCO)"]
    apt_statuses = ["completed", "completed", "completed", "completed",
                    "scheduled", "scheduled", "cancelled"]
    apt_outcomes = ["Progressing well", "Requires follow-up", "Referred to external service",
                    "Monitoring", "Goals reviewed and updated", None]

    all_s1, all_s2, all_p1, all_p2 = [], [], [], []
    all_prior_saebrs, all_prior_plus = [], []  # 6 historical screenings per student
    all_att_recs, all_int, all_notes, all_alerts, all_appts = [], [], [], [], []
    school_days_set = set(all_school_days)

    # Trajectory buckets: most students stable, some improve/decline over the year
    #   stable   — same tier across the year (gentle item-level drift only)
    #   improver — starts 1 tier worse than base, gradually moves to base by end
    #   decliner — starts at base, gradually drifts 1 tier worse
    def _traj_for(base):
        roll = rng.random()
        if roll < 0.15:
            return "improver"
        if roll < 0.28:
            return "decliner"
        return "stable"

    tier_order = ["low", "some", "high"]

    def _risk_at(base, traj, idx_0_to_7):
        """Given a base risk + trajectory, return the risk label for event idx (0 = oldest)."""
        if traj == "stable":
            return base
        base_idx = tier_order.index(base)
        if traj == "improver":
            # start one worse, end at base (event idx 0 worst, idx 7 best)
            offset = 1 if idx_0_to_7 < 4 else 0
            return tier_order[min(2, base_idx + offset)]
        # decliner: start at base, drift one worse by the last screening
        offset = 0 if idx_0_to_7 < 4 else 1
        return tier_order[min(2, base_idx + offset)]

    for idx, student in enumerate(students):
        sid = student["student_id"]
        base_risk = risk_assignments[idx]
        traj = _traj_for(base_risk)

        att_frac = rng.choice(att_map[base_risk]) / 100.0
        pref = student.get('preferred_name')
        first = student['first_name']
        display = f"{first}{(' (' + pref + ')') if pref and pref != first else ''} {student['last_name']}"

        def prof(risk):
            if risk == "low":   return low_s, low_a, low_e, sr_low
            if risk == "some":  return some_s, some_a, some_e, sr_some
            return high_s, high_a, high_e, sr_high

        def make_saebrs(s_items, a_items, e_items, screening_id, screening_period, ts):
            s = sum(s_items); a = sum(a_items); e = sum(e_items); t = s + a + e
            r, sr, ar, er = compute_saebrs_risk(t, s, a, e)
            return {"result_id": str(uuid.uuid4()), "student_id": sid, "screening_id": screening_id,
                    "screening_period": screening_period,
                    "social_items": s_items, "academic_items": a_items, "emotional_items": e_items,
                    "social_score": s, "academic_score": a, "emotional_score": e, "total_score": t,
                    "risk_level": r, "social_risk": sr, "academic_risk": ar, "emotional_risk": er,
                    "created_at": ts}

        def make_plus(saebrs_doc, sr_items, screening_id, screening_period, att, ts):
            soc = saebrs_doc["social_score"]; aca = saebrs_doc["academic_score"]
            rev = 3 - sr_items[0]
            emo = rev + sr_items[1] + sr_items[2]
            bel = sr_items[3] + sr_items[4] + sr_items[5] + sr_items[6]
            att_s = compute_attendance_score(att * 100)
            att_d = att_s * 3
            total = soc + aca + emo + bel + att_d
            return {"result_id": str(uuid.uuid4()), "student_id": sid, "screening_id": screening_id,
                    "screening_period": screening_period,
                    "self_report_items": sr_items, "attendance_pct": att * 100,
                    "social_domain": soc, "academic_domain": aca, "emotional_domain": emo,
                    "belonging_domain": bel, "attendance_domain": att_d,
                    "wellbeing_total": total, "wellbeing_tier": compute_wellbeing_tier(total),
                    "created_at": ts}

        # Generate a SAEBRS + self-report for every screening session
        student_events = []
        for ev_idx, sess in enumerate(screening_sessions):
            risk = _risk_at(base_risk, traj, ev_idx)
            s_items_p, a_items_p, e_items_p, sr_p = prof(risk)
            ts_iso = f"{sess['date']}T09:00:00"
            ts_plus = f"{sess['date']}T10:00:00"
            sae = make_saebrs(vary(s_items_p), vary(a_items_p), vary(e_items_p),
                              sess["screening_id"], sess["screening_period"], ts_iso)
            plus = make_plus(sae, vary(sr_p), sess["screening_id"], sess["screening_period"], att_frac, ts_plus)
            student_events.append((sae, plus))

        # Most-recent two events become "s1 (prior term)" and "s2 (current)" for
        # downstream alert / intervention / case-note logic. Earlier 6 are history.
        for sae, plus in student_events[:-2]:
            all_prior_saebrs.append(sae)
            all_prior_plus.append(plus)
        s1, p1 = student_events[-2]
        s2, p2 = student_events[-1]
        all_s1.append(s1); all_s2.append(s2)
        all_p1.append(p1); all_p2.append(p2)

        total_days = len(all_school_days)
        target_absent_count = int(total_days * (1 - att_frac))

        # Seasonal weighting: Australian winter (Jun-Aug) = flu season, roughly
        # 1.6× the base absence probability. Summer school days get ~0.9×.
        def _season_weight(iso_date):
            month = int(iso_date[5:7])
            if month in (6, 7, 8):   return 1.6
            if month in (2, 3):      return 0.9
            return 1.0

        weights = [_season_weight(d) for d in all_school_days]
        absent_indices = set(rng.choices(
            population=range(total_days),
            weights=weights,
            k=min(target_absent_count, total_days),
        ))

        neutral_indices = set()
        if base_risk == "low" and total_days > 5:
            neutral_indices = set(rng.sample(range(total_days), rng.randint(2, 6)))

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
                "created_at": f"{seed_year}-05-10T09:30:00", "is_read": False, "resolved": False, "status": "pending"
            })

        if att_frac * 100 < 80:
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "early_warning", "alert_type": "low_attendance_80", "severity": "high",
                "message": f"{display} critically low attendance ({att_frac * 100:.0f}%)",
                "created_at": f"{seed_year}-05-01T08:00:00", "is_read": False, "resolved": False, "status": "pending"
            })
        elif att_frac * 100 < 90:
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "early_warning", "alert_type": "low_attendance_90", "severity": "medium",
                "message": f"{display} attendance below 90% ({att_frac * 100:.0f}%)",
                "created_at": f"{seed_year}-05-01T08:00:00", "is_read": False, "resolved": False, "status": "pending"
            })

        if prev_tier != final_tier:
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "tier_change", "alert_type": "tier_change",
                "from_tier": prev_tier, "to_tier": final_tier,
                "severity": "high" if final_tier > prev_tier else "medium",
                "message": f"{display} moved from Tier {prev_tier} to Tier {final_tier}",
                "created_at": f"{seed_year}-05-10T09:30:00", "is_read": False, "resolved": False, "status": "pending"
            })

        staff_options = ["Ms Parker (Wellbeing)", "Mr Lewis (Counsellor)", "Ms Ahmed (SENCO)", student["teacher"]]
        int_types_t3 = ["Counselling", "Behaviour Support", "Social Skills Groups", "Check-In/Check-Out"]
        int_types_t2 = ["Mentoring", "Academic Support", "Attendance Intervention", "Parent Consultation"]

        if final_tier == 3:
            all_int.append({
                "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "intervention_type": rng.choice(int_types_t3), "assigned_staff": rng.choice(staff_options[:3]),
                "start_date": f"{seed_year}-04-28", "review_date": f"{seed_year}-06-09", "status": "active",
                "rationale": "Student is presenting with multiple Tier 3 risk indicators including chronic absenteeism, disengaged behaviour and limited peer connections. Intensive support is required to stabilise school attendance and build resilience.",
                "goals": "Reduce risk indicators, build coping strategies and improve school connectedness.",
                "progress_notes": "Initial engagement established. Student is attending sessions. Monitoring weekly progress.",
                "frequency": "3x weekly", "outcome_rating": None, "created_at": f"{seed_year}-04-28T09:00:00"
            })
            all_int.append({
                "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "intervention_type": rng.choice(int_types_t3), "assigned_staff": rng.choice(staff_options[:3]),
                "start_date": f"{seed_year}-02-03", "review_date": f"{seed_year}-03-28", "status": "completed",
                "rationale": "Referral raised following teacher concerns about social withdrawal and heightened anxiety. Programme aimed to establish a trusting relationship and develop a clearer picture of the student's support needs.",
                "goals": "Establish rapport and identify key risk factors.",
                "progress_notes": "Completed 8-week programme. Student showed moderate improvement in social engagement.",
                "frequency": "Weekly", "outcome_rating": rng.choice([3, 4, 4]), "created_at": f"{seed_year}-02-03T09:00:00"
            })
            for tmpl_idx, (ntype, ntext) in enumerate(case_note_templates.get(3, [])):
                note_dates = [f"{seed_year}-03-10", f"{seed_year}-04-14", f"{seed_year}-05-12"]
                all_notes.append({
                    "case_id": f"case_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "staff_member": rng.choice(["Ms Parker (Wellbeing)", student["teacher"], "Mr Lewis (Counsellor)"]),
                    "date": note_dates[tmpl_idx % len(note_dates)], "note_type": ntype, "notes": ntext,
                    "created_at": f"{seed_year}-0{3 + tmpl_idx}-10T11:00:00"
                })

            # Tier 3 students get 2-4 appointments
            for _ in range(rng.randint(2, 4)):
                apt_date = date_type(seed_year, rng.randint(3, 5), rng.randint(1, 28))
                apt_time = f"{rng.randint(9, 14)}:{rng.choice(['00', '15', '30', '45'])}:00"
                status = rng.choice(["completed", "completed", "completed", "scheduled"])
                all_appts.append({
                    "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
                    "student_id": sid, "student_name": display,
                    "class_name": student["class_name"],
                    "appointment_type": rng.choice(apt_types[:3]),
                    "staff_member": rng.choice(apt_staff),
                    "date": apt_date.isoformat(),
                    "time": apt_time,
                    "duration": rng.choice([30, 45, 60]),
                    "room": rng.choice(apt_rooms),
                    "status": status,
                    "outcome": rng.choice(apt_outcomes[:3]) if status == "completed" else None,
                    "notes": f"Session with {display} — {rng.choice(['discussed coping strategies', 'reviewed goals', 'parent phone call follow-up', 'check-in on attendance', 'SSG preparation'])}" if status == "completed" else "",
                    "created_at": f"{apt_date.isoformat()}T{apt_time}",
                })

        elif final_tier == 2:
            all_int.append({
                "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "intervention_type": rng.choice(int_types_t2), "assigned_staff": rng.choice(staff_options),
                "start_date": f"{seed_year}-04-28", "review_date": f"{seed_year}-06-09", "status": "active",
                "rationale": "Student has moved into Tier 2 following a pattern of irregular attendance and declining academic engagement. Proactive mentoring support has been initiated to prevent further escalation.",
                "goals": "Monitor emerging risk factors and build protective factors through regular check-ins.",
                "progress_notes": "Weekly check-ins established. Student is receptive to support.",
                "frequency": "Weekly", "outcome_rating": None, "created_at": f"{seed_year}-04-28T09:00:00"
            })
            if rng.random() < 0.5:
                all_int.append({
                    "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "intervention_type": rng.choice(int_types_t2), "assigned_staff": rng.choice(staff_options),
                    "start_date": f"{seed_year}-02-17", "review_date": f"{seed_year}-03-28", "status": "completed",
                    "rationale": "Early data indicated the student was beginning to disengage from learning. A short-term monitoring programme was put in place to address this before it developed into a more significant concern.",
                    "goals": "Early monitoring and prevention of further risk escalation.",
                    "progress_notes": "6-week monitoring programme complete. No escalation observed.",
                    "frequency": "Fortnightly", "outcome_rating": rng.choice([3, 4, 5]), "created_at": f"{seed_year}-02-17T09:00:00"
                })
            for tmpl_idx, (ntype, ntext) in enumerate(case_note_templates.get(2, [])):
                note_dates = [f"{seed_year}-04-07", f"{seed_year}-05-08"]
                all_notes.append({
                    "case_id": f"case_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "staff_member": rng.choice([student["teacher"], "Ms Parker (Wellbeing)"]),
                    "date": note_dates[tmpl_idx % len(note_dates)], "note_type": ntype, "notes": ntext,
                    "created_at": f"{seed_year}-0{4 + tmpl_idx}-07T09:30:00"
                })

            # Tier 2 students get 1-2 appointments
            for _ in range(rng.randint(1, 2)):
                apt_date = date_type(seed_year, rng.randint(3, 5), rng.randint(1, 28))
                apt_time = f"{rng.randint(9, 14)}:{rng.choice(['00', '15', '30', '45'])}:00"
                status = rng.choice(apt_statuses[:5])
                all_appts.append({
                    "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
                    "student_id": sid, "student_name": display,
                    "class_name": student["class_name"],
                    "appointment_type": rng.choice(apt_types),
                    "staff_member": rng.choice(apt_staff),
                    "date": apt_date.isoformat(),
                    "time": apt_time,
                    "duration": rng.choice([20, 30, 45]),
                    "room": rng.choice(apt_rooms),
                    "status": status,
                    "outcome": rng.choice(apt_outcomes) if status == "completed" else None,
                    "notes": f"Check-in with {display}" if status == "completed" else "",
                    "created_at": f"{apt_date.isoformat()}T{apt_time}",
                })

    # Insert demo school days by default; override with term-based days if terms are defined
    await db.school_days.insert_many([{"date": d, "year": seed_year} for d in sorted(school_days_set)])
    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    terms = (settings_doc or {}).get("terms", [])
    if terms:
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
            await db.school_days.insert_many([{"date": d, "year": seed_year} for d in sorted(term_days)])

    for col_data, col_name in [
        (all_prior_saebrs + all_s1 + all_s2, "saebrs_results"),
        (all_prior_plus   + all_p1 + all_p2, "self_report_results"),
        (all_att_recs,    "attendance_records"),
        (all_int,         "interventions"),
        (all_notes,       "case_notes"),
        (all_alerts,      "alerts"),
        (all_appts,       "appointments"),
    ]:
        if col_data:
            await db[col_name].insert_many(col_data)

    return {
        "message": "Demo data seeded",
        "students": len(students),
        "screening_events": len(screening_sessions),
        "saebrs_results": len(all_prior_saebrs) + len(all_s1) + len(all_s2),
        "school_days": len(school_days_set),
        "attendance_records": len(all_att_recs),
        "interventions": len(all_int),
        "case_notes": len(all_notes),
        "alerts": len(all_alerts),
        "appointments": len(all_appts),
    }
