from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import re
import httpx
import json as _json
import logging
import uuid
from datetime import datetime, timezone

from deps import get_tenant_db
from helpers import get_current_user, get_school_settings_doc, get_student_attendance_pct
from models import Intervention, CaseNote
from utils.audit import log_audit

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_rec(rec: dict) -> dict:
    """Normalise keys that small models commonly vary, mapping to the expected schema."""
    for alt in ('intervention_type', 'name', 'title', 'intervention', 'strategy'):
        if not rec.get('type') and rec.get(alt):
            rec['type'] = rec[alt]
            break
    for alt in ('urgency', 'level', 'importance', 'severity'):
        if not rec.get('priority') and rec.get(alt):
            rec['priority'] = rec[alt]
            break
    for alt in ('reason', 'description', 'explanation', 'justification', 'context'):
        if not rec.get('rationale') and rec.get(alt):
            rec['rationale'] = rec[alt]
            break
    for alt in ('goal', 'objectives', 'objective', 'outcomes', 'outcome', 'aims'):
        if not rec.get('goals') and rec.get(alt):
            rec['goals'] = rec[alt]
            break
    for alt in ('schedule', 'sessions', 'session', 'how_often', 'cadence'):
        if not rec.get('frequency') and rec.get(alt):
            rec['frequency'] = rec[alt]
            break
    for alt in ('duration', 'weeks', 'length', 'time', 'period'):
        if not rec.get('timeline') and rec.get(alt):
            rec['timeline'] = rec[alt]
            break
    p = str(rec.get('priority') or '').lower()
    if p in ('h', 'hi', '1', 'critical', 'urgent'):
        rec['priority'] = 'high'
    elif p in ('m', 'med', '2', 'moderate'):
        rec['priority'] = 'medium'
    elif p in ('l', 'lo', '3', 'low priority'):
        rec['priority'] = 'low'
    if rec.get('priority') not in ('high', 'medium', 'low'):
        rec['priority'] = 'medium'
    # Coerce all values to strings — LLMs sometimes return lists/dicts for fields like goals
    for key in ('type', 'rationale', 'goals', 'frequency', 'timeline'):
        val = rec.get(key)
        if isinstance(val, list):
            rec[key] = '; '.join(str(v) if isinstance(v, str) else v.get('goal', v.get('description', str(v))) if isinstance(v, dict) else str(v) for v in val)
        elif isinstance(val, dict):
            rec[key] = val.get('goal', val.get('description', str(val)))
        elif val is not None and not isinstance(val, str):
            rec[key] = str(val)
    return rec


def _extract_json_array(text: str):
    """Try multiple strategies to extract a JSON array from an LLM response, including truncated ones."""
    text = text.strip()
    # Strip markdown fences
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    # Direct parse
    try:
        data = _json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
    except Exception:
        pass
    # Markdown code block
    md = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL | re.IGNORECASE)
    if md:
        try:
            return _json.loads(md.group(1))
        except Exception:
            pass
    # Find array brackets
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end > start:
        try:
            return _json.loads(text[start:end + 1])
        except Exception:
            pass
    # Extract individual complete JSON objects (handles truncated arrays)
    objects = []
    depth = 0
    obj_start = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and obj_start is not None:
                fragment = text[obj_start:i + 1]
                try:
                    objects.append(_json.loads(fragment))
                except Exception:
                    pass
                obj_start = None
    if objects:
        return objects
    # Last resort: try to repair truncated single object by closing braces/quotes
    brace_start = text.find('{')
    if brace_start != -1:
        fragment = text[brace_start:]
        # Close any unclosed quotes and braces
        if fragment.count('"') % 2 != 0:
            fragment += '"'
        open_braces = fragment.count('{') - fragment.count('}')
        fragment += '}' * max(0, open_braces)
        try:
            obj = _json.loads(fragment)
            if isinstance(obj, dict):
                return [obj]
        except Exception:
            pass
    return None


@router.get("/interventions")
async def get_interventions(student_id: Optional[str] = None, status: Optional[str] = None,
                             user=Depends(get_current_user), db=Depends(get_tenant_db)):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    return await db.interventions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/interventions")
async def create_intervention(intervention: Intervention, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    d = intervention.model_dump()
    await db.interventions.insert_one({**d})
    student = await db.students.find_one({"student_id": d.get("student_id")}, {"first_name": 1, "last_name": 1, "_id": 0})
    sname = f"{student.get('first_name','')} {student.get('last_name','')}".strip() if student else d.get("student_id","")
    await log_audit(db, user, "created", "intervention", d.get("intervention_id",""),
                    f"{d.get('intervention_type','')} — {sname}",
                    metadata={"intervention_type": d.get("intervention_type"), "student_id": d.get("student_id")})
    return d


@router.put("/interventions/{iid}")
async def update_intervention(iid: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.interventions.find_one({"intervention_id": iid}, {"_id": 0})
    await db.interventions.update_one({"intervention_id": iid}, {"$set": data})
    updated = await db.interventions.find_one({"intervention_id": iid}, {"_id": 0})
    changes = {k: {"old": existing.get(k), "new": v} for k, v in data.items() if existing and existing.get(k) != v}
    student = await db.students.find_one({"student_id": updated.get("student_id")}, {"first_name": 1, "last_name": 1, "_id": 0})
    sname = f"{student.get('first_name','')} {student.get('last_name','')}".strip() if student else ""
    await log_audit(db, user, "updated", "intervention", iid,
                    f"{updated.get('intervention_type','')} — {sname}", changes=changes)
    return updated


@router.delete("/interventions/{iid}")
async def delete_intervention(iid: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.interventions.find_one({"intervention_id": iid}, {"_id": 0})
    await db.interventions.delete_one({"intervention_id": iid})
    name = f"{existing.get('intervention_type','')} — {existing.get('student_id','')}" if existing else iid
    await log_audit(db, user, "deleted", "intervention", iid, name)
    return {"message": "Deleted"}


@router.post("/interventions/ai-suggest/{student_id}")
async def get_ai_suggestions(student_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    import traceback
    try:
        settings_doc = await get_school_settings_doc(db)
        if not settings_doc.get("ai_suggestions_enabled", True):
            raise HTTPException(403, "AI suggestions are disabled. Enable in Settings > Integrations.")

        # Read Ollama config from platform-level config (control_db), fall back to school settings
        from control_db import control_db as _cdb
        platform_cfg = await _cdb.platform_config.find_one({"key": "ai"}, {"_id": 0}) or {}
        if platform_cfg.get("ai_suggestions_enabled") is False:
            raise HTTPException(403, "AI suggestions are disabled by the platform administrator.")
        ollama_url = platform_cfg.get("ollama_url") or settings_doc.get("ollama_url", "http://localhost:11434")
        ollama_model = platform_cfg.get("ollama_model") or settings_doc.get("ollama_model", "llama3.2")
        suggestion_count = int(platform_cfg.get("ai_suggestion_count", 3))

        student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
        if not student:
            raise HTTPException(404, "Student not found")

        # Fetch full screening history (up to 10 most recent), self-reports, attendance, case notes, interventions
        saebrs_history = await db.saebrs_results.find(
            {"student_id": student_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(10)
        plus_history = await db.self_report_results.find(
            {"student_id": student_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(10)
        att_pct = await get_student_attendance_pct(db, student_id)
        active_ints = await db.interventions.find({"student_id": student_id, "status": "active"}, {"_id": 0}).to_list(10)
        past_ints = await db.interventions.find({"student_id": student_id, "status": {"$ne": "active"}}, {"_id": 0}).sort("created_at", -1).to_list(5)
        recent_notes = await db.case_notes.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(3)
        att_records = await db.attendance_records.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(20)

        first = student.get('first_name', '')
        pref = student.get('preferred_name')
        display_name = f"{first}{(' (' + pref + ')') if pref and pref != first else ''} {student.get('last_name', '')}".strip()

        context = f"Student: {display_name}, Year Level: {student.get('year_level', 'Unknown')}"
        if student.get('gender'):
            context += f", {student.get('gender')}"
        if student.get('class_name'):
            context += f", Class: {student.get('class_name')}"
        context += "\n"

        # ── SAEBRS screening history with per-domain scores ──
        if saebrs_history:
            latest = saebrs_history[0]
            domains = {
                'Social':    (int(latest.get('social_score') or 0),    18),
                'Academic':  (int(latest.get('academic_score') or 0),  18),
                'Emotional': (int(latest.get('emotional_score') or 0), 21),
            }
            weakest = min(domains, key=lambda k: domains[k][0] / domains[k][1])
            total = int(latest.get('total_score') or 0)
            context += "\nSAEBRS Teacher Rating (most recent):\n"
            context += f"  Total: {total}/57 — Overall Risk: {latest.get('risk_level', 'Unknown')}\n"
            context += f"  Social Behaviour: {domains['Social'][0]}/18 — {latest.get('social_risk', 'Unknown')}\n"
            context += f"  Academic Behaviour: {domains['Academic'][0]}/18 — {latest.get('academic_risk', 'Unknown')}\n"
            context += f"  Emotional Behaviour: {domains['Emotional'][0]}/21 — {latest.get('emotional_risk', 'Unknown')}\n"
            context += f"  Primary area of concern: {weakest} ({domains[weakest][0]}/{domains[weakest][1]})\n"

            # Trajectory: show change over time if multiple screenings exist
            if len(saebrs_history) >= 2:
                context += f"\nScreening trajectory ({len(saebrs_history)} screenings, newest first):\n"
                for i, s in enumerate(saebrs_history[:5]):
                    date = s.get('created_at', 'Unknown date')
                    if isinstance(date, str) and len(date) > 10:
                        date = date[:10]
                    t = int(s.get('total_score') or 0)
                    soc = int(s.get('social_score') or 0)
                    aca = int(s.get('academic_score') or 0)
                    emo = int(s.get('emotional_score') or 0)
                    context += f"  {date}: Total={t}/57, Social={soc}/18, Academic={aca}/18, Emotional={emo}/21 ({s.get('risk_level', '?')})\n"

                oldest = saebrs_history[-1]
                old_total = int(oldest.get('total_score') or 0)
                diff = total - old_total
                direction = "improving" if diff > 0 else ("declining" if diff < 0 else "stable")
                context += f"  Trend: {direction} (change of {diff:+d} points from first to latest screening)\n"
        else:
            context += "SAEBRS: Not yet screened\n"

        # ── SAEBRS+ Self-report data ──
        if plus_history:
            latest_plus = plus_history[0]
            wb_total = int(latest_plus.get('wellbeing_total') or latest_plus.get('total_score') or 0)
            wb_tier = latest_plus.get('wellbeing_tier', '?')
            context += "\nSAEBRS+ Student Self-Report (most recent):\n"
            context += f"  Wellbeing Total: {wb_total}, Tier: {wb_tier}\n"
            if len(plus_history) >= 2:
                old_plus = plus_history[-1]
                old_wb = int(old_plus.get('wellbeing_total') or old_plus.get('total_score') or 0)
                wb_diff = wb_total - old_wb
                wb_dir = "improving" if wb_diff > 0 else ("declining" if wb_diff < 0 else "stable")
                context += f"  Self-report trend: {wb_dir} ({wb_diff:+d} points across {len(plus_history)} assessments)\n"

        # ── Attendance ──
        context += f"\nAttendance: {(att_pct or 0):.1f}%\n"
        if att_records:
            from collections import Counter
            absence_types = Counter(r.get('absence_type', 'Unknown') for r in att_records if r.get('absence_type') and r.get('absence_type') != 'Present')
            if absence_types:
                top_reasons = absence_types.most_common(3)
                context += f"  Recent absence reasons: {', '.join(f'{t} ({c}x)' for t, c in top_reasons)}\n"

        _EAL_YES = {'yes', 'y', 'true', '1', 'eal', 'eal/d', 'eald', 'lbote', 'lote',
                    'english as additional language', 'english as an additional language',
                    'language background other than english'}
        _ATSI_YES = {'yes', 'y', 'true', '1', 'aboriginal', 'torres strait islander',
                     'atsi', 'indigenous', 'aboriginal and torres strait islander',
                     'aboriginal/torres strait islander', 'aboriginal and/or torres strait islander'}
        extras = []
        eal = str(student.get('eal_status') or '').strip().lower()
        if eal in _EAL_YES:
            extras.append("EAL/D student (English as an Additional Language or Dialect)")
        aboriginal = str(student.get('aboriginal_status') or '').strip().lower()
        if aboriginal in _ATSI_YES:
            extras.append("Aboriginal and/or Torres Strait Islander student")
        nccd_cat = str(student.get('nccd_category') or '').strip()
        nccd_lvl = str(student.get('nccd_level') or '').strip()
        _NCCD_NO = {'', 'none', 'n/a', 'not applicable', 'no', 'false', '0'}
        if nccd_cat and nccd_cat.lower() not in _NCCD_NO:
            label = f"NCCD: {nccd_cat}"
            if nccd_lvl and nccd_lvl.lower() not in _NCCD_NO:
                label += f" - {nccd_lvl}"
            extras.append(label)
        if extras:
            context += "Additional context:\n" + "".join(f"  - {e}\n" for e in extras)

        active_types = [i.get('intervention_type', '') for i in active_ints if i.get('intervention_type')]
        context += f"Current active interventions: {', '.join(active_types) if active_types else 'None'}\n"

        # Past/completed interventions
        if past_ints:
            context += f"Past interventions ({len(past_ints)} most recent):\n"
            for pi in past_ints:
                pi_type = pi.get('intervention_type', 'Unknown')
                pi_status = pi.get('status', 'unknown')
                pi_outcome = pi.get('outcome', '')
                context += f"  - {pi_type} ({pi_status})"
                if pi_outcome:
                    context += f" — Outcome: {pi_outcome}"
                context += "\n"

        # Recent case notes (summaries only)
        if recent_notes:
            context += "Recent case notes:\n"
            for cn in recent_notes:
                cn_date = cn.get('date', 'Unknown')
                if isinstance(cn_date, str) and len(cn_date) > 10:
                    cn_date = cn_date[:10]
                cn_type = cn.get('note_type', '')
                cn_content = str(cn.get('content', ''))[:150]
                context += f"  - [{cn_date}] {cn_type}: {cn_content}\n"

        available = settings_doc.get("intervention_types") or []
        # Normalize: items may be strings or dicts with a "name" key
        available = [t if isinstance(t, str) else t.get('name', str(t)) for t in available]
        if available:
            context += f"\nAvailable interventions at this school: {', '.join(available)}\n"

        library_rule = (
            f"- Suggestions 1 and 2 MUST come from the available interventions list above and must not be currently active\n"
            f"- Suggestion 3 can be from the list OR a new practical school-based intervention\n"
        ) if available and suggestion_count >= 3 else (
            f"- Suggestions should come from the available interventions list above where possible\n"
        ) if available else (
            f"- All suggestions should be practical, evidence-based interventions achievable in a school setting\n"
        )

        prompt = (
            f"You are an experienced school wellbeing coordinator writing a detailed MTSS student support plan.\n\n"
            f"{context}\n"
            f"Suggest exactly {suggestion_count} separate intervention{'s' if suggestion_count > 1 else ''} for this student. Each must be a fully independent recommendation.\n"
            f"{library_rule}"
            f"- Do NOT suggest interventions already listed as currently active\n"
            f"- Keep suggestions realistic and appropriate for the student's year level\n"
            f"- Only mention EAL/D, Aboriginal/ATSI, NCCD, or other demographic context in the rationale "
            f"if those details are explicitly listed above under 'Additional context'. Do not assume or invent any demographic details.\n\n"
            f"For each intervention provide:\n"
            f"- type: the intervention name\n"
            f"- priority: exactly 'high', 'medium', or 'low'\n"
            f"- rationale: a detailed 2-3 sentence explanation of WHY this intervention is appropriate for this student, "
            f"referencing their specific screening scores, attendance data, or domain concerns. Be specific, not generic.\n"
            f"- goals: 2-3 specific, measurable goals the intervention aims to achieve. "
            f"Include observable behaviours or metrics where possible (e.g., 'Reduce unexplained absences to fewer than 2 per term').\n"
            f"- frequency: how often sessions occur (e.g., 'Daily 15-minute check-ins', '2x per week 30-minute sessions')\n"
            f"- timeline: realistic duration (e.g., '8 weeks with review at Week 4', 'Ongoing for Term 2 with fortnightly progress monitoring')\n\n"
            f"Return ONLY a valid JSON array containing exactly {suggestion_count} object{'s' if suggestion_count > 1 else ''}. Each object must have ALL of these keys with non-empty string values: "
            f"type, priority, rationale, goals, frequency, timeline.\n"
            f"Do NOT put multiple interventions inside a single object. Each object = one intervention.\n"
            f"No markdown, no explanation, no text before or after the JSON array.\n"
            f'Example: [{{"type":"Check-In Check-Out","priority":"high","rationale":"With a SAEBRS emotional score of 8/21 and attendance at 76%, this student is showing signs of disengagement and emotional distress. A structured daily check-in provides a consistent adult connection point and early detection of escalating concerns.","goals":"Increase attendance to above 85% within 6 weeks. Student to self-identify and communicate one emotion daily. Reduce office referrals for emotional dysregulation by 50%.","frequency":"Daily 10-minute check-in each morning with assigned staff member, plus brief afternoon check-out","timeline":"8 weeks with formal review at Week 4 to assess progress and adjust support"}}]'
        )

        logger.info(f"AI suggest for {student_id}: prompt length={len(prompt)}, model={ollama_model}, url={ollama_url}")

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"num_predict": 4096},
                }
            )
            if resp.status_code == 404:
                raise HTTPException(503, f"Model '{ollama_model}' not found. Run: ollama pull {ollama_model}")
            resp.raise_for_status()
            content = resp.json().get("response", "")
            logger.info(f"Ollama response (first 400 chars): {content[:400]}")
            recs = _extract_json_array(content)
            if recs is not None:
                normalized = [_normalize_rec(r) for r in recs[:suggestion_count]]
                logger.info(f"Parsed {len(normalized)} recommendations, keys: {[list(r.keys()) for r in normalized]}")
                return {"recommendations": normalized}
            raise HTTPException(500, f"Could not parse AI response as JSON. Raw: {content[:200]}")

    except httpx.ConnectError:
        raise HTTPException(503, f"Cannot connect to Ollama at {ollama_url}. Ensure Ollama is running.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI suggest error for {student_id}:\n{traceback.format_exc()}")
        raise HTTPException(500, f"AI service error: {str(e)}")


# ── Case Notes ───────────────────────────────────────────────────────────────

def extract_mentions(text: str) -> list:
    """Extract @mentions from text (format: @username or @User Name)."""
    pattern = r'@([a-zA-Z0-9_\-\s]+?)(?=\s|$|[^a-zA-Z0-9_\-\s])'
    matches = re.findall(pattern, text)
    return [m.strip() for m in matches if m.strip()]


@router.get("/case-notes")
async def get_case_notes(student_id: Optional[str] = None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    q = {}
    if student_id:
        q["student_id"] = student_id
    return await db.case_notes.find(q, {"_id": 0}).sort("date", -1).to_list(500)


@router.post("/case-notes")
async def add_case_note(note: CaseNote, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    d = note.model_dump()
    content = d.get("notes", "")

    # Extract mentions from content
    mention_names = extract_mentions(content)
    mentioned_user_ids = []

    if mention_names:
        # Look up users by name
        for name in mention_names:
            # Try exact match on name field
            mentioned_user = await db.users.find_one(
                {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}},
                {"_id": 0, "user_id": 1, "name": 1}
            )
            if mentioned_user:
                mentioned_user_ids.append(mentioned_user["user_id"])

    # Add mentions to the note data
    d["mentions"] = mentioned_user_ids
    d["mentions_count"] = len(mentioned_user_ids)

    await db.case_notes.insert_one({**d})

    # Create notifications for mentioned users
    student = await db.students.find_one({"student_id": d.get("student_id")}, {"first_name": 1, "last_name": 1, "_id": 0})
    sname = f"{student.get('first_name','')} {student.get('last_name','')}".strip() if student else d.get("student_id","")

    for user_id in mentioned_user_ids:
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "type": "mention",
            "title": "You were mentioned in a case note",
            "message": f"{user.get('name', 'Someone')} mentioned you in a note about {sname}",
            "related_student_id": d.get("student_id"),
            "related_case_note_id": d.get("case_id"),
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await log_audit(db, user, "created", "case_note", d.get("case_id",""),
                    f"Case note — {sname}", metadata={"note_type": d.get("note_type"), "student_id": d.get("student_id"), "mentions": len(mentioned_user_ids)})
    return d


@router.put("/case-notes/{case_id}")
async def update_case_note(case_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    data.pop("_id", None)
    data.pop("case_id", None)
    await db.case_notes.update_one({"case_id": case_id}, {"$set": data})
    updated = await db.case_notes.find_one({"case_id": case_id}, {"_id": 0})
    await log_audit(db, user, "updated", "case_note", case_id,
                    f"Case note — {updated.get('student_id','')}" if updated else case_id)
    return updated


@router.delete("/case-notes/{case_id}")
async def delete_case_note(case_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.case_notes.find_one({"case_id": case_id}, {"_id": 0})
    await db.case_notes.delete_one({"case_id": case_id})
    await log_audit(db, user, "deleted", "case_note", case_id,
                    f"Case note — {existing.get('student_id','')}" if existing else case_id)
    return {"message": "Deleted"}


# ── Bulk Intervention Assignment ─────────────────────────────────────────────

@router.post("/interventions/bulk")
async def bulk_create_interventions(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Create the same intervention for multiple students at once."""
    student_ids = data.get("student_ids", [])
    base_intervention = data.get("intervention", {})
    use_template_id = data.get("use_template_id")

    if not student_ids:
        raise HTTPException(400, "No students selected")

    # Load template if specified
    template = None
    if use_template_id:
        settings = await db.school_settings.find_one({}, {"_id": 0})
        templates = settings.get("intervention_templates", []) if settings else []
        template = next((t for t in templates if t.get("template_id") == use_template_id), None)
        if not template:
            raise HTTPException(404, "Template not found")

    created = []
    errors = []

    for student_id in student_ids:
        try:
            student = await db.students.find_one({"student_id": student_id}, {"_id": 0, "first_name": 1, "last_name": 1})
            if not student:
                errors.append({"student_id": student_id, "error": "Student not found"})
                continue

            intervention_id = f"int_{uuid.uuid4().hex[:8]}"

            # Build intervention from template or base data
            if template:
                start_date = base_intervention.get("start_date", today_str())
                review_date = base_intervention.get("review_date", get_in_days(7 * template.get("default_duration_weeks", 8)))

                doc = {
                    "intervention_id": intervention_id,
                    "student_id": student_id,
                    "intervention_type": template["intervention_type"],
                    "assigned_staff": base_intervention.get("assigned_staff", user.get("name", "")),
                    "start_date": start_date,
                    "review_date": review_date,
                    "status": "active",
                    "goals": template["goals"],
                    "rationale": template["rationale"],
                    "frequency": template["frequency"],
                    "progress_notes": f"Created from template: {template['name']}",
                    "outcome_rating": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                doc = {
                    "intervention_id": intervention_id,
                    "student_id": student_id,
                    "intervention_type": base_intervention.get("intervention_type", "Support"),
                    "assigned_staff": base_intervention.get("assigned_staff", user.get("name", "")),
                    "start_date": base_intervention.get("start_date", today_str()),
                    "review_date": base_intervention.get("review_date", get_in_days(56)),
                    "status": "active",
                    "goals": base_intervention.get("goals", ""),
                    "rationale": base_intervention.get("rationale", ""),
                    "frequency": base_intervention.get("frequency", ""),
                    "progress_notes": "",
                    "outcome_rating": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

            await db.interventions.insert_one({**doc})
            created.append({"student_id": student_id, "student_name": f"{student.get('first_name','')} {student.get('last_name','')}".strip(), "intervention_id": intervention_id})
        except Exception as e:
            errors.append({"student_id": student_id, "error": str(e)})

    await log_audit(db, user, "bulk_created", "intervention", "",
                    f"Bulk intervention creation — {len(created)} students",
                    bulk_count=len(created), metadata={"student_ids": student_ids})

    return {"created": created, "errors": errors, "count": len(created)}


# ── Intervention Templates API ───────────────────────────────────────────────

@router.get("/intervention-templates")
async def get_intervention_templates(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Get all intervention templates from settings."""
    settings = await db.school_settings.find_one({}, {"_id": 0})
    templates = settings.get("intervention_templates", []) if settings else []
    return templates


@router.post("/intervention-templates")
async def create_intervention_template(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Add a custom intervention template."""
    if user.get("role") not in ["admin", "leadership", "wellbeing"]:
        raise HTTPException(403, "Access denied")

    template = {
        "template_id": f"template_{uuid.uuid4().hex[:8]}",
        "name": data.get("name", ""),
        "intervention_type": data.get("intervention_type", ""),
        "description": data.get("description", ""),
        "goals": data.get("goals", ""),
        "rationale": data.get("rationale", ""),
        "frequency": data.get("frequency", ""),
        "default_duration_weeks": data.get("default_duration_weeks", 8),
        "recommended_tiers": data.get("recommended_tiers", []),
        "applicable_risk_profiles": data.get("applicable_risk_profiles", []),
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.school_settings.update_one(
        {},
        {"$push": {"intervention_templates": template}},
        upsert=True
    )

    await log_audit(db, user, "created", "intervention_template", template["template_id"],
                    f"Template: {template['name']}")
    return template


@router.put("/intervention-templates/{template_id}")
async def update_intervention_template(template_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Update a custom intervention template."""
    if user.get("role") not in ["admin", "leadership", "wellbeing"]:
        raise HTTPException(403, "Access denied")

    data.pop("template_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.school_settings.update_one(
        {"intervention_templates.template_id": template_id},
        {"$set": {f"intervention_templates.$.{k}": v for k, v in data.items()}}
    )

    await log_audit(db, user, "updated", "intervention_template", template_id,
                    f"Updated template: {data.get('name', '')}")
    return {"message": "Template updated"}


@router.delete("/intervention-templates/{template_id}")
async def delete_intervention_template(template_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Delete a custom intervention template (cannot delete defaults)."""
    if user.get("role") not in ["admin", "leadership", "wellbeing"]:
        raise HTTPException(403, "Access denied")

    # Check if it's a default template
    settings = await db.school_settings.find_one({}, {"_id": 0})
    templates = settings.get("intervention_templates", []) if settings else []
    template = next((t for t in templates if t.get("template_id") == template_id), None)

    if template and template.get("is_default"):
        raise HTTPException(400, "Cannot delete default templates")

    await db.school_settings.update_one(
        {},
        {"$pull": {"intervention_templates": {"template_id": template_id}}}
    )

    await log_audit(db, user, "deleted", "intervention_template", template_id)
    return {"message": "Template deleted"}


# ── Auto-Suggest Interventions ───────────────────────────────────────────────

@router.get("/interventions/suggest/{student_id}")
async def suggest_interventions(student_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Suggest interventions based on student's risk profile and tier."""
    # Get student data
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")

    # Get latest screening data
    from helpers import get_latest_saebrs_bulk, get_latest_saebrs_plus_bulk, get_student_attendance_pct
    saebrs_map = await get_latest_saebrs_bulk(db, [student_id])
    plus_map = await get_latest_saebrs_plus_bulk(db, [student_id])
    att_pct = await get_student_attendance_pct(db, student_id)

    saebrs = saebrs_map.get(student_id)
    plus = plus_map.get(student_id)

    # Determine tier
    tier = None
    if saebrs and plus:
        from helpers import compute_mtss_tier
        tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
    elif saebrs:
        tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)

    # Build risk profile
    risk_profiles = []
    if saebrs:
        if saebrs.get("social_risk") != "Low Risk":
            risk_profiles.append("social")
        if saebrs.get("academic_risk") != "Low Risk":
            risk_profiles.append("academic")
        if saebrs.get("emotional_risk") != "Low Risk":
            risk_profiles.append("emotional")
    if plus:
        if plus.get("emotional_domain", 9) <= 3:
            risk_profiles.append("emotional")
        if plus.get("belonging_domain", 12) <= 4:
            risk_profiles.append("belonging")
    if att_pct < 90:
        risk_profiles.append("attendance")

    # Get templates
    settings = await db.school_settings.find_one({}, {"_id": 0})
    templates = settings.get("intervention_templates", []) if settings else []

    # Score templates by match
    scored_templates = []
    for t in templates:
        score = 0
        reasons = []

        # Tier match (0-3 points)
        if tier and tier in t.get("recommended_tiers", []):
            score += 3
            reasons.append(f"Recommended for Tier {tier}")

        # Risk profile match (1 point each)
        for risk in risk_profiles:
            if risk in t.get("applicable_risk_profiles", []):
                score += 1
                reasons.append(f"Matches {risk} risk profile")

        # Boost defaults slightly
        if t.get("is_default"):
            score += 0.5

        if score > 0:
            scored_templates.append({
                **t,
                "match_score": score,
                "match_reasons": reasons
            })

    # Sort by score
    scored_templates.sort(key=lambda x: -x["match_score"])

    # Get existing interventions to avoid duplicates
    existing = await db.interventions.find(
        {"student_id": student_id, "status": "active"},
        {"_id": 0, "intervention_type": 1}
    ).to_list(50)
    existing_types = {i["intervention_type"] for i in existing}

    # Mark already-active interventions
    for t in scored_templates:
        t["already_active"] = t["intervention_type"] in existing_types

    return {
        "student_id": student_id,
        "student_name": f"{student.get('first_name','')} {student.get('last_name','')}".strip(),
        "mtss_tier": tier,
        "risk_profiles": list(set(risk_profiles)),
        "attendance_pct": round(att_pct, 1) if att_pct else None,
        "suggestions": scored_templates[:5],
        "has_active_interventions": len(existing) > 0
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def today_str():
    return datetime.now(timezone.utc).date().isoformat()

def get_in_days(n):
    return (datetime.now(timezone.utc).date() + timedelta(days=n)).isoformat()
