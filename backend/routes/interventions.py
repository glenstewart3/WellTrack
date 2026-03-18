from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import re, httpx

from database import db
from helpers import get_current_user, get_school_settings_doc, get_student_attendance_pct
from models import Intervention, CaseNote

router = APIRouter()


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

    display_name = student.get('first_name', '')
    if student.get('preferred_name'):
        display_name += f" ({student['preferred_name']})"
    display_name += f" {student.get('last_name', '')}"

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
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={"model": ollama_model, "prompt": prompt, "stream": False}
            )
            resp.raise_for_status()
            content = resp.json().get("response", "")
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                import json as _json
                recs = _json.loads(json_match.group())
                return {"recommendations": recs[:3]}
            return {"recommendations": []}
    except httpx.ConnectError:
        raise HTTPException(503, f"Cannot connect to Ollama at {ollama_url}. Ensure Ollama is running.")
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
