"""
seed.py — Demo data generator for WellTrack.
Called by POST /api/settings/seed
"""
import uuid, random
from datetime import timedelta, date as date_type

from helpers import (compute_saebrs_risk, compute_wellbeing_tier,
                     compute_attendance_score, compute_mtss_tier)


async def seed_database(db, student_count: int = 32):
    student_count = max(0, student_count)

    for col in ["students", "attendance", "attendance_records", "school_days", "screening_sessions",
                "saebrs_results", "self_report_results", "interventions", "case_notes", "alerts",
                "appointments", "action_plans", "calendar_events", "notifications", "reports"]:
        await db[col].delete_many({})

    await db.school_settings.update_one({}, {"$set": {
        "excluded_absence_types": ["Camp", "Excursion", "School Event"],
        "role_permissions": {
            "teacher": ["dashboard", "screening", "students", "radar", "analytics", "reports", "interventions", "action-plans", "meeting", "alerts", "settings", "calendar", "notifications"],
            "screener": ["screening", "students", "settings", "calendar", "notifications"],
            "wellbeing": ["dashboard", "screening", "students", "radar", "analytics", "reports", "interventions", "action-plans", "appointments", "meeting", "alerts", "settings", "calendar", "notifications"],
            "professional": ["dashboard", "students", "interventions", "action-plans", "appointments", "meeting", "settings", "calendar", "notifications"],
            "leadership": ["dashboard", "screening", "students", "radar", "analytics", "reports", "interventions", "action-plans", "attendance", "meeting", "alerts", "settings", "calendar", "notifications"],
        },
        "feature_permissions": {
            "teacher": ["students.add_edit", "case_notes.add_edit", "interventions.add_edit", "interventions.ai_suggest", "screenings.submit", "analytics.export", "reports.view", "reports.export", "action-plans.add_edit"],
            "screener": ["screenings.submit", "students.view", "reports.view"],
            "wellbeing": ["students.add_edit", "case_notes.add_edit", "case_notes.delete", "interventions.add_edit", "interventions.delete", "interventions.ai_suggest", "screenings.submit", "alerts.approve", "analytics.export", "appointments.delete", "reports.view", "reports.export", "action-plans.add_edit", "action-plans.delete"],
            "professional": ["students.view", "interventions.add_edit", "interventions.ai_suggest", "appointments.add_edit", "action-plans.add_edit", "reports.view"],
            "leadership": ["students.add_edit", "students.archive", "case_notes.add_edit", "case_notes.delete", "alerts.approve", "attendance.upload", "analytics.export", "appointments.delete", "reports.view", "reports.export", "reports.export_pdf", "action-plans.add_edit", "action-plans.delete", "calendar.manage"],
        }
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

    # ── Tier distribution: exact 70% T1 / 20% T2 / 10% T3
    t3_count = int(student_count * 0.10)   # 10% Tier 3
    t2_count = int(student_count * 0.20)   # 20% Tier 2
    t1_count = student_count - t3_count - t2_count  # 70% Tier 1

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

    # ── Build 16 screening events spanning 2 years (8 per year) ────────────────
    today = date_type.today()
    most_recent = today - timedelta(days=14)
    # 16 events: 8 in current year, 8 in previous year
    event_gaps_days = [45 * i for i in range(16)]
    event_dates = sorted([most_recent - timedelta(days=g) for g in event_gaps_days])

    def _term_for(d):
        doy = d.timetuple().tm_yday
        if doy < 100:  return 1
        if doy < 187:  return 2
        if doy < 270:  return 3
        return 4

    screening_sessions = []
    events_with_term = []
    for ev_date in event_dates:
        events_with_term.append((ev_date, _term_for(ev_date)))

    from collections import defaultdict
    period_counter = defaultdict(int)
    for ev_date, term in events_with_term:
        period_counter[(ev_date.year, term)] += 1
        period_num = period_counter[(ev_date.year, term)]
        label = f"Term {term} - P{period_num}"
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

    # Split screening sessions by year for student data generation
    current_year_sessions = [s for s in screening_sessions if s["year"] == most_recent.year]
    prev_year_sessions = [s for s in screening_sessions if s["year"] == (most_recent.year - 1)]

    # ── Initialize class-level screening data tracking ──────────────────────
    # Structure: {screening_id: {class_name: {scores: [], tiers: [], students: []}}}
    class_screening_data = {s["screening_id"]: {} for s in screening_sessions}

    # ── Build ~440 school days spanning the past 2 years ─────────────────────
    def _in_school_holiday(d):
        md = (d.month, d.day)
        return (
            md >= (12, 18) or md <= (1, 27) or
            (4, 3) <= md <= (4, 22) or
            (7, 4) <= md <= (7, 19) or
            (9, 26) <= md <= (10, 9)
        )

    two_years_ago = most_recent - timedelta(days=730)
    all_school_days = []
    d = two_years_ago
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

    # ── Expanded case note templates by tier ────────────────────────────────────
    case_note_templates = {
        3: [  # Tier 3: intensive support
            ("wellbeing", "Wellbeing check-in. Student reported feeling overwhelmed and anxious about upcoming assessments. Discussed breathing techniques and time management strategies. Will follow up next week."),
            ("behaviour", "Incident report: Student became distressed during group work and left the classroom. Spoke with student after — they shared they are struggling at home. Referred to school counsellor."),
            ("general", "Follow-up meeting with parent/guardian. Family aware of school concerns. Parent noted similar behaviours at home. Collaborative support plan being drafted. Counsellor to lead."),
            ("wellbeing", "Crisis support session. Student experiencing significant emotional dysregulation. Safety plan reviewed and updated. Emergency contacts confirmed."),
            ("behaviour", "Functional behaviour assessment observation completed. Triggers identified: transitions, group work, unstructured time. Support plan to be developed."),
            ("general", "SSG meeting held. Multi-disciplinary team reviewing support needs. Adjustments to learning plan recommended."),
        ],
        2: [  # Tier 2: targeted support
            ("general", "Regular check-in. Student appears to be managing but showing early signs of disengagement. Monitoring closely and checking in weekly. Encouraged to use check-in card."),
            ("wellbeing", "Student self-referred to discuss friendship difficulties. Provided social skills strategies. Will observe in unstructured times and check in again next week."),
            ("behaviour", "Teacher report: student off-task during independent work. Discussed goals and expectations. Student receptive to support."),
            ("wellbeing", "Attendance concern noted. Student arriving late 2-3 times per week. Family contacted to discuss barriers."),
        ],
        1: [  # Tier 1: universal (minimal notes)
            ("general", "Routine wellbeing survey completed. No concerns identified. Student engaging positively."),
            ("wellbeing", "Brief check-in. Student reports feeling supported and connected at school."),
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

    # Track tier distribution for reporting
    tier_counts = {1: 0, 2: 0, 3: 0}

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

        # Generate a SAEBRS + self-report for every screening session (16 sessions = 2 years)
        student_events = []
        for ev_idx, sess in enumerate(screening_sessions):
            risk = _risk_at(base_risk, traj, ev_idx)
            s_items_p, a_items_p, e_items_p, sr_p = prof(risk)
            ts_iso = f"{sess['date']}T09:00:00"
            ts_plus = f"{sess['date']}T10:00:00"
            sae = make_saebrs(vary(s_items_p), vary(a_items_p), vary(e_items_p),
                              sess["screening_id"], sess["screening_period"], ts_iso)
            plus = make_plus(sae, vary(sr_p), sess["screening_id"], sess["screening_period"], att_frac, ts_plus)
            student_events.append((sae, plus, sess["year"]))

        # Split by year for tier progression tracking
        prev_year_events = [(s, p) for s, p, y in student_events if y == (most_recent.year - 1)]
        curr_year_events = [(s, p) for s, p, y in student_events if y == most_recent.year]

        # Previous year: last 2 screenings determine end-of-year tier
        if prev_year_events:
            for sae, plus in prev_year_events[:-2]:
                all_prior_saebrs.append(sae)
                all_prior_plus.append(plus)
            # Store previous year's final tier for year-over-year comparison
            if len(prev_year_events) >= 2:
                py_s1, py_p1 = prev_year_events[-2]
                py_s2, py_p2 = prev_year_events[-1]
                prev_year_tier = compute_mtss_tier(py_s2["risk_level"], py_p2["wellbeing_tier"], att_frac * 100)

        # Current year: last 2 screenings for current snapshot
        if curr_year_events:
            for sae, plus in curr_year_events[:-2]:
                all_prior_saebrs.append(sae)
                all_prior_plus.append(plus)
            s1, p1 = curr_year_events[-2] if len(curr_year_events) >= 2 else curr_year_events[-1]
            s2, p2 = curr_year_events[-1]
            all_s1.append(s1); all_s2.append(s2)
            all_p1.append(p1); all_p2.append(p2)

        # ── Track class-level screening data ────────────────────────────────────
        # Aggregate all this student's screening results by class
        class_name = student["class_name"]
        for sae, plus, year in student_events:
            scr_id = sae["screening_id"]
            if scr_id not in class_screening_data:
                class_screening_data[scr_id] = {}
            if class_name not in class_screening_data[scr_id]:
                class_screening_data[scr_id][class_name] = {
                    "scores": [], "tiers": [], "students": [], "risk_levels": []
                }
            tier = compute_mtss_tier(sae["risk_level"], plus["wellbeing_tier"], att_frac * 100)
            class_screening_data[scr_id][class_name]["scores"].append(sae["total_score"])
            class_screening_data[scr_id][class_name]["tiers"].append(tier)
            class_screening_data[scr_id][class_name]["students"].append(sid)
            class_screening_data[scr_id][class_name]["risk_levels"].append(sae["risk_level"])

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
        tier_counts[final_tier] += 1

        # Year-over-year tier progression alert (if previous year data exists)
        if 'prev_year_tier' in locals() and prev_year_tier != final_tier:
            direction = "improved" if final_tier < prev_year_tier else "requires increased support"
            all_alerts.append({
                "alert_id": f"alrt_{uuid.uuid4().hex[:8]}", "student_id": sid,
                "student_name": display, "class_name": student["class_name"],
                "type": "yearly_progress",
                "alert_type": "tier_progression_year_over_year",
                "from_tier": prev_year_tier, "to_tier": final_tier,
                "severity": "high" if final_tier > prev_year_tier else "medium",
                "message": f"{display} has {direction} from Tier {prev_year_tier} (last year) to Tier {final_tier} (this year).",
                "created_at": f"{seed_year}-02-01T09:00:00", "is_read": False, "resolved": False, "status": "pending"
            })

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
            # Multiple completed Tier 3 interventions with diverse outcomes
            t3_completed_count = rng.randint(2, 4)
            for ci in range(t3_completed_count):
                start_month = 2 if ci == 0 else (5 if ci == 1 else (8 if ci == 2 else 10))
                end_month = min(start_month + 3, 12)
                # Tier 3 outcomes weighted toward success (intensive support works)
                outcome_weights = [0.05, 0.1, 0.2, 0.35, 0.3]  # 1, 2, 3, 4, 5
                outcome = rng.choices([1, 2, 3, 4, 5], weights=outcome_weights)[0]
                status = "completed" if outcome >= 3 else "closed"
                notes_t3 = [
                    "Crisis intervention only. Student referred to external mental health services for ongoing support.",
                    "Limited progress due to complex needs. Transitioned to alternative support pathways.",
                    "Stabilised but ongoing concerns remain. Student responding to intensive support.",
                    "Significant improvement observed. Student successfully stepped down to Tier 2 support.",
                    "Exceptional progress. Student's risk indicators reduced and resilience significantly improved.",
                ][outcome - 1]
                all_int.append({
                    "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "intervention_type": rng.choice(int_types_t3), "assigned_staff": rng.choice(staff_options[:3]),
                    "start_date": f"{seed_year}-{start_month:02d}-01", "review_date": f"{seed_year}-{end_month:02d}-15", "status": status,
                    "rationale": "Intensive support for high-risk indicators identified through screening and observation.",
                    "goals": "Stabilise attendance, improve emotional regulation, build school connectedness.",
                    "progress_notes": notes_t3,
                    "frequency": rng.choice(["Daily", "3x weekly", "Weekly"]),
                    "outcome_rating": outcome,
                    "created_at": f"{seed_year}-{start_month:02d}-01T09:00:00"
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
            # Multiple completed interventions with varying outcomes
            completed_int_count = rng.randint(1, 3)
            for ci in range(completed_int_count):
                int_types = rng.choice(int_types_t2)
                start_month = 2 if ci == 0 else (5 if ci == 1 else 8)
                end_month = start_month + 2
                # Varying outcomes: some successful (4-5), some partial (3), some unsuccessful (1-2)
                outcome_weights = [0.1, 0.15, 0.25, 0.3, 0.2]  # 1, 2, 3, 4, 5
                outcome = rng.choices([1, 2, 3, 4, 5], weights=outcome_weights)[0]
                status = "completed" if outcome >= 3 else "closed"
                notes = [
                    "Limited engagement. Family barriers prevented consistent attendance.",
                    "Some progress made but goals not fully achieved. Referred to external service.",
                    "Goals partially met. Student showed improvement in target areas.",
                    "Good progress. Student engaged well and met most goals.",
                    "Excellent outcome. Student exceeded goals and gained confidence.",
                ][outcome - 1]
                all_int.append({
                    "intervention_id": f"int_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "intervention_type": int_types, "assigned_staff": rng.choice(staff_options),
                    "start_date": f"{seed_year}-{start_month:02d}-15", "review_date": f"{seed_year}-{end_month:02d}-15", "status": status,
                    "rationale": "Early monitoring and support based on screening data and teacher referral.",
                    "goals": "Build protective factors and monitor risk indicators.",
                    "progress_notes": notes,
                    "frequency": rng.choice(["Weekly", "Fortnightly"]),
                    "outcome_rating": outcome,
                    "created_at": f"{seed_year}-{start_month:02d}-15T09:00:00"
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

        else:  # Tier 1: Universal support - minimal interventions
            # ~10% of Tier 1 students have a brief check-in note
            if rng.random() < 0.10:
                tmpl = rng.choice(case_note_templates.get(1, []))
                all_notes.append({
                    "case_id": f"case_{uuid.uuid4().hex[:8]}", "student_id": sid,
                    "staff_member": student["teacher"],
                    "date": f"{seed_year}-04-15", "note_type": tmpl[0], "notes": tmpl[1],
                    "created_at": f"{seed_year}-04-15T10:00:00"
                })
            # ~5% of Tier 1 students have a single appointment
            if rng.random() < 0.05:
                apt_date = date_type(seed_year, rng.randint(3, 5), rng.randint(1, 28))
                apt_time = f"{rng.randint(9, 14)}:{rng.choice(['00', '15', '30', '45'])}:00"
                all_appts.append({
                    "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
                    "student_id": sid, "student_name": display,
                    "class_name": student["class_name"],
                    "appointment_type": "Wellbeing Check-In",
                    "staff_member": rng.choice(apt_staff),
                    "date": apt_date.isoformat(),
                    "time": apt_time,
                    "duration": 20,
                    "room": rng.choice(apt_rooms),
                    "status": "completed",
                    "outcome": "No concerns identified",
                    "notes": f"Routine check-in with {display}",
                    "created_at": f"{apt_date.isoformat()}T{apt_time}",
                })

    # ── Generate class-level screening aggregates ────────────────────────────
    all_class_screenings = []
    class_alerts = []  # Class-level alerts for high-risk concentrations
    for scr_id, classes_data in class_screening_data.items():
        # Find the screening session to get year and date
        scr_session = next((s for s in screening_sessions if s["screening_id"] == scr_id), None)
        if not scr_session:
            continue
        for class_name, data in classes_data.items():
            if not data["scores"]:
                continue
            scores = data["scores"]
            tiers = data["tiers"]
            total = len(scores)
            # Calculate tier breakdown
            tier_counts_cls = {1: tiers.count(1), 2: tiers.count(2), 3: tiers.count(3)}
            tier_pcts = {k: round(v / total * 100, 1) for k, v in tier_counts_cls.items()}
            # Determine class risk level
            if tier_pcts[3] >= 15 or tier_pcts[2] + tier_pcts[3] >= 40:
                class_risk = "high"
            elif tier_pcts[3] >= 5 or tier_pcts[2] >= 25:
                class_risk = "elevated"
            else:
                class_risk = "low"
            # Find the teacher for this class
            teacher = classes_data.get(class_name, {}).get("teacher", "")
            if not teacher:
                # Look up from students
                cls_student = next((s for s in students if s["class_name"] == class_name), None)
                teacher = cls_student["teacher"] if cls_student else ""
            class_screening = {
                "class_screening_id": f"cs_{uuid.uuid4().hex[:8]}",
                "screening_id": scr_id,
                "screening_period": scr_session["screening_period"],
                "class_name": class_name,
                "teacher": teacher,
                "year": scr_session["year"],
                "date": scr_session["date"],
                "students_screened": total,
                "avg_saebrs_total": round(sum(scores) / total, 1),
                "avg_saebrs_social": round(sum([s for s in scores]) / total * 0.3, 1),  # Approximate
                "tier_breakdown": {
                    "tier_1": tier_counts_cls[1],
                    "tier_2": tier_counts_cls[2],
                    "tier_3": tier_counts_cls[3],
                    "tier_1_pct": tier_pcts[1],
                    "tier_2_pct": tier_pcts[2],
                    "tier_3_pct": tier_pcts[3],
                },
                "class_risk_level": class_risk,
                "high_risk_count": data["risk_levels"].count("High Risk"),
                "some_risk_count": data["risk_levels"].count("Some Risk"),
                "low_risk_count": data["risk_levels"].count("Low Risk"),
                "created_at": scr_session["date"],
            }
            all_class_screenings.append(class_screening)
            # Generate class-level alert if elevated/high risk
            if class_risk in ("elevated", "high"):
                severity = "high" if class_risk == "high" else "medium"
                alert_msg = f"{class_name} shows {class_risk} wellbeing risk. "
                if tier_pcts[3] >= 10:
                    alert_msg += f"{tier_pcts[3]:.0f}% of students are Tier 3 (high risk). "
                if tier_pcts[2] >= 30:
                    alert_msg += f"{tier_pcts[2]:.0f}% of students are Tier 2 (some risk). "
                alert_msg += "Consider class-wide intervention strategies."
                class_alerts.append({
                    "alert_id": f"alrt_{uuid.uuid4().hex[:8]}",
                    "type": "class_risk",
                    "alert_type": f"class_{class_risk}_risk",
                    "severity": severity,
                    "class_name": class_name,
                    "screening_period": scr_session["screening_period"],
                    "message": alert_msg,
                    "tier_breakdown": class_screening["tier_breakdown"],
                    "created_at": f"{scr_session['date']}T12:00:00",
                    "is_read": False,
                    "resolved": False,
                    "status": "pending",
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

    # Combine individual and class-level alerts
    all_alerts_combined = all_alerts + class_alerts

    # ── Generate Support Plans (Action Plans) for Tier 2 & 3 students ───────
    all_action_plans = []
    plan_templates = [
        ("Attendance Support Plan", "Improve attendance through early morning check-ins and parent engagement"),
        ("Behaviour Support Plan", "Develop self-regulation strategies and conflict resolution skills"),
        ("Academic Support Plan", "Targeted literacy intervention with multi-sensory approach"),
        ("Social Skills Plan", "Build peer relationships through structured play and buddy systems"),
        ("Emotional Regulation Plan", "Teach coping strategies for anxiety and emotional dysregulation"),
    ]
    for idx, student in enumerate(students):
        # Only Tier 2 and 3 get support plans
        base_risk = risk_assignments[idx]
        if base_risk == "low":
            continue
        sid = student["student_id"]
        pref = student.get('preferred_name')
        first = student['first_name']
        display = f"{first}{(' (' + pref + ')') if pref and pref != first else ''} {student['last_name']}"
        # 1-2 support plans per eligible student
        for pi in range(rng.randint(1, 2)):
            tmpl = plan_templates[pi % len(plan_templates)]
            start_month = rng.randint(2, 5)
            start_day = rng.randint(1, 28)
            start_date = f"{seed_year}-{start_month:02d}-{start_day:02d}"
            review_month = min(start_month + 2, 12)
            review_date = f"{seed_year}-{review_month:02d}-{start_day:02d}"
            status = rng.choice(["active", "active", "completed"])
            all_action_plans.append({
                "plan_id": f"plan_{uuid.uuid4().hex[:8]}",
                "student_id": sid,
                "student_name": display,
                "title": tmpl[0],
                "description": tmpl[1],
                "goals": [
                    {"id": str(uuid.uuid4()), "text": "Reduce absenteeism by 20% within 6 weeks", "completed": status == "completed"},
                    {"id": str(uuid.uuid4()), "text": "Improve engagement in class activities", "completed": rng.random() > 0.5},
                ],
                "strategies": [
                    {"description": rng.choice([
                        "Daily check-in with mentor teacher",
                        "Visual schedule and transition warnings",
                        "Parent communication log",
                        "Break card access",
                    ]), "responsible": rng.choice(["Teacher", "Wellbeing Staff", "Parent"])}
                ],
                "start_date": start_date,
                "review_date": review_date,
                "status": status,
                "staff_member": rng.choice(staff_options),
                "created_at": f"{start_date}T09:00:00",
            })

    # ── Generate Calendar Events (Screening Periods, Terms) ─────────────────
    all_calendar_events = []
    # Term dates
    terms_data = [
        {"name": "Term 1", "start": f"{seed_year}-01-29", "end": f"{seed_year}-03-28", "type": "term"},
        {"name": "Term 2", "start": f"{seed_year}-04-15", "end": f"{seed_year}-06-28", "type": "term"},
        {"name": "Term 3", "start": f"{seed_year}-07-15", "end": f"{seed_year}-09-20", "type": "term"},
        {"name": "Term 4", "start": f"{seed_year}-10-07", "end": f"{seed_year}-12-20", "type": "term"},
    ]
    for term in terms_data:
        all_calendar_events.append({
            "event_id": f"cal_{uuid.uuid4().hex[:8]}",
            "title": f"{term['name']}",
            "date": term["start"],
            "type": term["type"],
            "detail": f"Term Start",
            "created_at": f"{term['start']}T00:00:00",
        })
        all_calendar_events.append({
            "event_id": f"cal_{uuid.uuid4().hex[:8]}",
            "title": f"{term['name']} End",
            "date": term["end"],
            "type": term["type"],
            "detail": f"Term End",
            "created_at": f"{term['end']}T00:00:00",
        })
    # Screening period windows (based on screening sessions)
    for sess in screening_sessions:
        all_calendar_events.append({
            "event_id": f"cal_{uuid.uuid4().hex[:8]}",
            "title": f"Screening: {sess['screening_period']}",
            "date": sess["date"],
            "type": "screening",
            "detail": f"SAEBRS + Wellbeing Screening",
            "screening_id": sess["screening_id"],
            "created_at": f"{sess['date']}T00:00:00",
        })
    # Add intervention review dates from the interventions we created
    for intv in all_int:
        if intv.get("review_date"):
            all_calendar_events.append({
                "event_id": f"cal_{uuid.uuid4().hex[:8]}",
                "title": f"Review: {intv['intervention_type']}",
                "date": intv["review_date"],
                "type": "intervention",
                "detail": f"Student review for {intv['intervention_type']}",
                "student_id": intv["student_id"],
                "intervention_id": intv["intervention_id"],
                "created_at": f"{intv['review_date']}T00:00:00",
            })
    # Add support plan review dates
    for plan in all_action_plans:
        if plan.get("review_date"):
            all_calendar_events.append({
                "event_id": f"cal_{uuid.uuid4().hex[:8]}",
                "title": f"Review: {plan['title']}",
                "date": plan["review_date"],
                "type": "intervention",
                "detail": plan["title"],
                "student_id": plan["student_id"],
                "plan_id": plan["plan_id"],
                "created_at": f"{plan['review_date']}T00:00:00",
            })
    # Add appointment dates
    for apt in all_appts:
        if apt.get("date"):
            all_calendar_events.append({
                "event_id": f"cal_{uuid.uuid4().hex[:8]}",
                "title": f"{apt['student_name']} - {apt['appointment_type']}",
                "date": apt["date"],
                "type": "appointment",
                "detail": f"{apt['staff_member']} - {apt.get('room', 'TBC')}",
                "student_id": apt["student_id"],
                "appointment_id": apt["appointment_id"],
                "created_at": f"{apt['date']}T00:00:00",
            })

    # ── Generate Notifications for Demo Users ────────────────────────────────
    all_notifications = []
    demo_users = [
        {"user_id": "user_teacher_001", "name": "Ms Patel", "role": "teacher"},
        {"user_id": "user_wellbeing_001", "name": "Ms Parker", "role": "wellbeing"},
        {"user_id": "user_leadership_001", "name": "Mr Principal", "role": "leadership"},
    ]
    notification_templates = [
        ("alert", "New Alert", "A student has moved to Tier 3 and requires immediate support"),
        ("screening", "Screening Due", "SAEBRS screening window opens next week"),
        ("appointment", "Appointment Reminder", "You have a parent meeting scheduled tomorrow"),
        ("intervention", "Review Due", "Intervention review due for student"),
        ("system", "System Update", "New features available in WellTrack"),
    ]
    for user in demo_users:
        for ni in range(rng.randint(3, 6)):
            tmpl = notification_templates[ni % len(notification_templates)]
            days_ago = rng.randint(0, 14)
            notif_date = date_type.today() - timedelta(days=days_ago)
            all_notifications.append({
                "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "type": tmpl[0],
                "title": tmpl[1],
                "message": tmpl[2],
                "is_read": days_ago > 3,  # Older ones are read
                "created_at": f"{notif_date.isoformat()}T{rng.randint(8, 16):02d}:00:00",
            })

    # ── Generate Sample Reports ─────────────────────────────────────────────
    all_reports = []
    report_templates = [
        ("Tier Distribution Report", "Overview of student tiers by year level and class"),
        ("Screening Summary", "SAEBRS and wellbeing screening results by term"),
        ("Attendance Analysis", "Students with attendance below 90%"),
        ("Intervention Outcomes", "Summary of intervention effectiveness"),
        ("Class Risk Profile", "Wellbeing risk levels by classroom"),
    ]
    for ri, rtmpl in enumerate(report_templates):
        all_reports.append({
            "report_id": f"rpt_{uuid.uuid4().hex[:8]}",
            "name": rtmpl[0],
            "description": rtmpl[1],
            "type": rng.choice(["summary", "detailed", "export"]),
            "filters": {
                "year": seed_year,
                "terms": ["Term 1", "Term 2"],
                "year_levels": ["Foundation", "Year 1", "Year 3", "Year 5"],
            },
            "created_by": rng.choice([u["user_id"] for u in demo_users]),
            "created_at": f"{seed_year}-0{ri+2}-15T10:00:00",
        })

    for col_data, col_name in [
        (all_prior_saebrs + all_s1 + all_s2, "saebrs_results"),
        (all_prior_plus   + all_p1 + all_p2, "self_report_results"),
        (all_att_recs,    "attendance_records"),
        (all_int,         "interventions"),
        (all_notes,       "case_notes"),
        (all_alerts_combined, "alerts"),
        (all_appts,       "appointments"),
        (all_class_screenings, "class_screenings"),
        (all_action_plans, "action_plans"),
        (all_calendar_events, "calendar_events"),
        (all_notifications, "notifications"),
        (all_reports,     "reports"),
    ]:
        if col_data:
            await db[col_name].insert_many(col_data)

    return {
        "message": "Demo data seeded (2 years)",
        "students": len(students),
        "years": {
            "previous": most_recent.year - 1,
            "current": most_recent.year,
        },
        "tier_distribution": {
            "tier_1": tier_counts[1],
            "tier_2": tier_counts[2],
            "tier_3": tier_counts[3],
            "tier_1_pct": round(tier_counts[1] / len(students) * 100, 1) if students else 0,
            "tier_2_pct": round(tier_counts[2] / len(students) * 100, 1) if students else 0,
            "tier_3_pct": round(tier_counts[3] / len(students) * 100, 1) if students else 0,
        },
        "screening_events": len(screening_sessions),
        "screening_events_per_year": len(current_year_sessions),
        "saebrs_results": len(all_prior_saebrs) + len(all_s1) + len(all_s2),
        "school_days": len(school_days_set),
        "school_days_per_year": len(school_days_set) // 2,
        "attendance_records": len(all_att_recs),
        "interventions": len(all_int),
        "case_notes": len(all_notes),
        "alerts": len(all_alerts),
        "appointments": len(all_appts),
        "class_screenings": len(all_class_screenings),
        "class_alerts": len(class_alerts),
        "classes": len({s["class_name"] for s in students}),
        "action_plans": len(all_action_plans),
        "calendar_events": len(all_calendar_events),
        "notifications": len(all_notifications),
        "reports": len(all_reports),
    }
