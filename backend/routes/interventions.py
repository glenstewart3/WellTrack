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


def _extract_json_array(text: str):
    """Try multiple strategies to extract a JSON array from an LLM response."""
    text = text.strip()
    # 1. Direct parse — model returned clean JSON
    try:
        data = _json.loads(text)
        if isinstance(data, list):
            return data
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

    context = f"Student: {display_name.strip()}, Year Level: {student.get('year_level', 'Unknown')}\n"
    if latest_saebrs:
        context += f"SAEBRS: {latest_saebrs['total_score']}/57 ({latest_saebrs['risk_level']}) - Social: {latest_saebrs.get('social_score', 0)}, Academic: {latest_saebrs.get('academic_score', 0)}, Emotional: {latest_saebrs.get('emotional_score', 0)}\n"
    else:
        context += "SAEBRS: Not screened\n"
    context += f"Attendance: {att_pct:.1f}%\n"
    context += f"Current interventions: {[i['intervention_type'] for i in active_ints] or ['None']}\n"

    prompt = f"""You are an MTSS specialist. Based on this student's data, suggest 3 evidence-based interventions.

{context}

Respond with ONLY a valid JSON array of exactly 3 objects, each with:
- "type": intervention name
- "priority": "high", "medium", or "low"
- "rationale": brief explanation (1-2 sentences)
- "goals": measurable goal (1 sentence)
- "frequency": how often
- "timeline": duration

Example: [{{"type": "Counselling", "priority": "high", "rationale": "...", "goals": "...", "frequency": "Weekly", "timeline": "8 weeks"}}]"""

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={"model": ollama_model, "prompt": prompt, "stream": False}
            )
            resp.raise_for_status()
            content = resp.json().get("response", "")
            logger.info(f"Ollama raw response (first 400 chars): {content[:400]}")
            recs = _extract_json_array(content)
            if recs is not None:
                return {"recommendations": recs[:3]}
            logger.warning(f"Could not parse JSON from Ollama response: {content[:300]}")
            raise HTTPException(500, f"AI returned a response but it could not be parsed as JSON. Raw output: {content[:300]}")
    except httpx.ConnectError:
        raise HTTPException(503, f"Cannot connect to Ollama at {ollama_url}. Ensure Ollama is running on the server.")
    except HTTPException:
        raise
    except Exception as e:
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
