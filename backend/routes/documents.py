from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from typing import Optional
import uuid, os
from pathlib import Path
from datetime import datetime, timezone

from deps import get_tenant_db
from helpers import get_current_user
from utils.audit import log_audit

_UPLOADS_BASE = Path(os.environ.get("UPLOADS_DIR", str(Path(__file__).resolve().parent.parent / "uploads")))

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".rtf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Roles permitted to upload/edit/delete student documents.
# Read access is open to any authenticated user (matches the rest of the student profile).
_DOC_WRITE_ROLES = {"admin", "leadership", "wellbeing", "professional"}


def _require_doc_write_role(user: dict):
    """Authorisation guard for document mutation endpoints."""
    if user.get("role") not in _DOC_WRITE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to modify student documents.",
        )


router = APIRouter()


def _get_docs_dir(request: Request, student_id: str) -> Path:
    slug = getattr(request.state, "tenant_slug", None) or "default"
    path = _UPLOADS_BASE / slug / "student_documents" / student_id
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.get("/students/{student_id}/documents")
async def list_documents(student_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """List all documents for a student."""
    docs = await db.student_documents.find(
        {"student_id": student_id}, {"_id": 0}
    ).sort("uploaded_at", -1).to_list(100)
    return docs


@router.post("/students/{student_id}/documents")
async def upload_document(
    request: Request,
    student_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db=Depends(get_tenant_db),
):
    """Upload a document for a student."""
    _require_doc_write_role(user)
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0, "student_id": 1, "first_name": 1, "last_name": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    fname = file.filename or "unnamed"
    ext = Path(fname).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB")

    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    safe_name = f"{doc_id}{ext}"
    docs_dir = _get_docs_dir(request, student_id)
    (docs_dir / safe_name).write_bytes(content)

    slug = getattr(request.state, "tenant_slug", None) or "default"
    download_url = f"/api/student-documents/{slug}/{student_id}/{safe_name}"

    doc = {
        "document_id": doc_id,
        "student_id": student_id,
        "original_filename": fname,
        "stored_filename": safe_name,
        "file_extension": ext,
        "file_size": len(content),
        "download_url": download_url,
        "uploaded_by": user.get("user_id"),
        "uploaded_by_name": user.get("name", ""),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "category": "general",
    }
    await db.student_documents.insert_one({**doc})
    await log_audit(db, user, "uploaded", "document", doc_id,
                    f"Document '{fname}' for {student.get('first_name', '')} {student.get('last_name', '')}")
    return doc


@router.put("/students/{student_id}/documents/{document_id}")
async def update_document(student_id: str, document_id: str, data: dict,
                          user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Update document metadata (category, notes)."""
    _require_doc_write_role(user)
    allowed = {"category", "notes"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.student_documents.update_one(
        {"document_id": document_id, "student_id": student_id}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Document not found")
    return {"success": True}


@router.delete("/students/{student_id}/documents/{document_id}")
async def delete_document(request: Request, student_id: str, document_id: str,
                          user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Delete a document."""
    _require_doc_write_role(user)
    doc = await db.student_documents.find_one({"document_id": document_id, "student_id": student_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Remove file from disk
    docs_dir = _get_docs_dir(request, student_id)
    fpath = docs_dir / doc["stored_filename"]
    if fpath.exists():
        fpath.unlink()

    await db.student_documents.delete_one({"document_id": document_id})
    await log_audit(db, user, "deleted", "document", document_id,
                    f"Document '{doc.get('original_filename', '')}' removed")
    return {"success": True}
