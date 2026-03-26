from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import re
import httpx
import json as _json
import logging

from database import db
from helpers import get_current_user, get_school_settings_doc, get_student_attendance_pct
from models import Intervention, CaseNote

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_rec(rec: dict) -> dict:
    """Normalise keys that small models commonly vary, mapping to the expected schema."""
    # type
    for alt in ('intervention_type', 'name', 'title', 'intervention', 'strategy'):
        if not rec.get('type') and rec.get(alt):
            rec['type'] = rec[alt]
            break
    # priority
    for alt in ('urgency', 'level', 'importance', 'severity'):
        if not rec.get('priority') and rec.get(alt):
            rec['priority'] = rec[alt]
            break
    # rationale
    for alt in ('reason', 'description', 'explanation', 'justification', 'context'):
        if not rec.get('rationale') and rec.get(alt):
            rec['rationale'] = rec[alt]
            break
    # goals
    for alt in ('goal', 'objectives', 'objective', 'outcomes', 'outcome', 'aims'):
        if not rec.get('goals') and rec.get(alt):
            rec['goals'] = rec[alt]
            break
    # frequency
    for alt in ('schedule', 'sessions', 'session', 'how_often', 'cadence'):
        if not rec.get('frequency') and rec.get(alt):
            rec['frequency'] = rec[alt]
            break
    # timeline
    for alt in ('duration', 'weeks', 'length', 'time', 'period'):
        if not rec.get('timeline') and rec.get(alt):
            rec['timeline'] = rec[alt]
            break
    # Normalise priority to low/medium/high
    p = str(rec.get('priority') or '').lower()
    if p in ('h', 'hi', '1', 'critical', 'urgent'):
        rec['priority'] = 'high'
    elif p in ('m', 'med', '2', 'moderate'):
        rec['priority'] = 'medium'
    elif p in ('l', 'lo', '3', 'low priority'):
        rec['priority'] = 'low'
    if rec.get('priority') not in ('high', 'medium', 'low'):
        rec['priority'] = 'medium'
    return rec


def _extract_json_array(text: str):
    """Try multiple strategies to extract a JSON array from an LLM response."""
    text = text.strip()

    # 1. Direct parse — model returned clean JSON array
    try:
        data = _json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
    except Exception:
        pass

    # 2. Markdown code block  ```json [...] ```
    md = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL | re.IGNORECASE)
    if md:
        try:
            return _json.loads(md.group(1))
        except Exception:
            pass

    # 3. First [...] bracket pair
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end > start:
        try:
            return _json.loads(text[start:end + 1])
        except Exception:
            pass

    # 4. Collect all top-level {...} objects and wrap in array
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

    return None


@router.get("/interventions")
async def get_interventions(student_id: Optional[str] = None, status: Optional[str] = None,
                             user=Depends(get_current_user)):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    return await db.interventions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/interventions")
async def create_intervention(intervention: Intervention, user=Depends(get_current_user)):
    d = intervention.model_dump()
    await db.interventions.insert_one({**d})
    return d


@router.put("/interventions/{iid}")
async def update_intervention(iid: str, data: dict, user=Depends(get_current_user)):
    await db.interventions.update_one({"intervention_id": iid}, {"$set": data})
    return await db.interventions.find_one({"intervention_id": iid}, {"_id": 0})


@router.delete("/interventions/{iid}")
async def delete_intervention(iid: str, user=Depends(get_current_user)):
    await db.interventions.delete_one({"intervention_id": iid})
    return {"message": "Deleted"}


@router.post("/interventions/ai-suggest/{student_id}")
async def get_ai_suggestions(student_id: str, user=Depends(get_current_user)):
    import traceback
    try:
        settings_doc = await get_school_settings_doc()
        if not settings_doc.get("ai_suggestions_enabled", True):
            raise HTTPException(403, "AI suggestions are disabled. Enable in Settings > Integrations.")

        ollama_url = settings_doc.get("ollama_url", "http://localhost:11434")
        ollama_model = settings_doc.get("ollama_model", "llama3.2")

        student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
        if not student:
            raise HTTPException(404, "Student not found")

        latest_saebrs = await db.saebrs_results.find_one({"student_id": student_id}, {"_id": 0}, sort=[("created_at", -1)])
        att_pct = await get_student_attendance_pct(student_id)
        active_ints = await db.interventions.find({"student_id": student_id, "status": "active"}, {"_id": 0}).to_list(10)

        first = student.get('first_name', '')
        pref = student.get('preferred_name')
        display_name = f"{first}{(' (' + pref + ')') if pref and pref != first else ''} {student.get('last_name', '')}".strip()

        # Build context
        context = f"Student: {display_name}, Year Level: {student.get('year_level', 'Unknown')}"
        if student.get('gender'):
            context += f", {student.get('gender')}"
        context += "\n"

        if latest_saebrs:
            domains = {
                'Social':    (int(latest_saebrs.get('social_score') or 0),    18),
                'Academic':  (int(latest_saebrs.get('academic_score') or 0),  18),
                'Emotional': (int(latest_saebrs.get('emotional_score') or 0), 21),
            }
            weakest = min(domains, key=lambda k: domains[k][0] / domains[k][1])
            total = int(latest_saebrs.get('total_score') or 0)
            context += f"SAEBRS Score: {total}/57 ({latest_saebrs.get('risk_level', 'Unknown')})\n"
            context += f"  - Social: {domains['Social'][0]}/18, Academic: {domains['Academic'][0]}/18, Emotional: {domains['Emotional'][0]}/21\n"
            context += f"  - Area of greatest concern: {weakest} ({domains[weakest][0]}/{domains[weakest][1]})\n"
        else:
            context += "SAEBRS: Not yet screened\n"

        context += f"Attendance: {(att_pct or 0):.1f}%\n"

        # EAL / Aboriginal / NCCD context
        extras = []
        eal = str(student.get('eal_status') or '').strip().lower()
        if eal and eal not in ('no', 'none', 'n/a', '', 'false'):
            extras.append("EAL/D student (English as an Additional Language or Dialect)")
        aboriginal = str(student.get('aboriginal_status') or '').strip().lower()
        if aboriginal and aboriginal not in ('no', 'none', 'n/a', '', 'false', 'non-indigenous'):
            extras.append("Aboriginal and/or Torres Strait Islander student")
        nccd_cat = str(student.get('nccd_category') or '').strip()
        nccd_lvl = str(student.get('nccd_level') or '').strip()
        if nccd_cat and nccd_cat.lower() not in ('none', '', 'n/a'):
            label = f"NCCD: {nccd_cat}"
            if nccd_lvl and nccd_lvl.lower() not in ('none', '', 'n/a'):
                label += f" - {nccd_lvl}"
            extras.append(label)
        if extras:
            context += "Additional context:\n" + "".join(f"  - {e}\n" for e in extras)

        active_types = [i.get('intervention_type', '') for i in active_ints if i.get('intervention_type')]
        context += f"Current active interventions: {', '.join(active_types) if active_types else 'None'}\n"

        available = settings_doc.get("intervention_types") or []
        if available:
            context += f"\nAvailable interventions at this school: {', '.join(available)}\n"

        library_rule = (
            "- Suggestions 1 and 2 MUST come from the available interventions list above and must not be currently active\n"
            "- Suggestion 3 can be from the list OR a new practical school-based intervention\n"
        ) if available else (
            "- All 3 should be practical, evidence-based interventions achievable in a school setting\n"
        )

        prompt = (
            f"You are a school wellbeing coordinator writing an MTSS student support plan.\n\n"
            f"{context}\n"
            f"Suggest exactly 3 interventions for this student:\n"
            f"{library_rule}"
            f"- Do NOT suggest interventions already listed as currently active\n"
            f"- Keep suggestions realistic and appropriate for the student's year level\n"
            f"- Where relevant, mention EAL/D, Aboriginal/ATSI background, NCCD, attendance or weakest SAEBRS domain in the rationale\n\n"
            f"Respond with ONLY a valid JSON array of exactly 3 objects with keys: "
            f"type, priority (high/medium/low), rationale, goals, frequency, timeline.\n"
            f"Return ONLY the JSON array. No markdown, no explanation.\n"
            f'Example: [{{"type":"Check-In Check-Out","priority":"high","rationale":"...","goals":"...","frequency":"Daily","timeline":"8 weeks"}}]'
        )

        logger.info(f"AI suggest for {student_id}: prompt length={len(prompt)}, model={ollama_model}, url={ollama_url}")

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={"model": ollama_model, "prompt": prompt, "stream": False}
            )
            if resp.status_code == 404:
                raise HTTPException(503, f"Model '{ollama_model}' not found. Run: ollama pull {ollama_model}")
            resp.raise_for_status()
            content = resp.json().get("response", "")
            logger.info(f"Ollama response (first 400 chars): {content[:400]}")
            recs = _extract_json_array(content)
            if recs is not None:
                normalized = [_normalize_rec(r) for r in recs[:3]]
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

@router.get("/case-notes")
async def get_case_notes(student_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if student_id:
        q["student_id"] = student_id
    return await db.case_notes.find(q, {"_id": 0}).sort("date", -1).to_list(500)


@router.post("/case-notes")
async def add_case_note(note: CaseNote, user=Depends(get_current_user)):
    d = note.model_dump()
    await db.case_notes.insert_one({**d})
    return d


@router.put("/case-notes/{case_id}")
async def update_case_note(case_id: str, data: dict, user=Depends(get_current_user)):
    data.pop("_id", None)
    data.pop("case_id", None)
    await db.case_notes.update_one({"case_id": case_id}, {"$set": data})
    return await db.case_notes.find_one({"case_id": case_id}, {"_id": 0})


@router.delete("/case-notes/{case_id}")
async def delete_case_note(case_id: str, user=Depends(get_current_user)):
    await db.case_notes.delete_one({"case_id": case_id})
    return {"message": "Deleted"}
