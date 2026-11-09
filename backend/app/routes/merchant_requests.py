import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import MerchantInformationRequest, MerchantResponse, Case, Merchant, AuditEvent, Notification
from ..auth import get_current_user, require_write_permission

router = APIRouter(prefix="/merchant-requests", tags=["Merchant Information Requests"])

class CreateRequestInput(BaseModel):
    case_id: str
    merchant_id: str
    request_type: str # unusual_timing, volume_spike, invoice_records, business_clarification, payer_patterns, updated_details
    subject: str
    message: str
    due_days: int = 2

class SubmitResponseInput(BaseModel):
    response_text: str
    attachment_filenames: Optional[List[str]] = None

@router.get("")
def list_requests(
    merchant_id: Optional[str] = None,
    case_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(MerchantInformationRequest)
    if merchant_id:
        query = query.filter(MerchantInformationRequest.merchant_id == merchant_id)
    if case_id:
        query = query.filter(MerchantInformationRequest.case_id == case_id)
    if status_filter:
        query = query.filter(MerchantInformationRequest.status == status_filter)
        
    items = query.order_by(desc(MerchantInformationRequest.created_at)).all()
    results = []
    for r in items:
        m = db.query(Merchant).filter(Merchant.id == r.merchant_id).first()
        resps = db.query(MerchantResponse).filter(MerchantResponse.request_id == r.id).all()
        results.append({
            "id": r.id,
            "case_id": r.case_id,
            "merchant_id": r.merchant_id,
            "merchant_name": m.name if m else r.merchant_id,
            "request_type": r.request_type,
            "subject": r.subject,
            "message": r.message,
            "due_date": r.due_date.isoformat(),
            "status": r.status,
            "created_by_name": r.created_by_name,
            "created_at": r.created_at.isoformat(),
            "responses": [{
                "id": resp.id,
                "response_text": resp.response_text,
                "attachments": json.loads(resp.attachment_filenames) if resp.attachment_filenames else [],
                "submitted_at": resp.submitted_at.isoformat(),
                "reviewer_verified": resp.reviewer_verified
            } for resp in resps]
        })
    return results

@router.post("")
def create_information_request(
    req: CreateRequestInput,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    case = db.query(Case).filter(Case.id == req.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    merchant = db.query(Merchant).filter(Merchant.id == req.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    due_date = now + datetime.timedelta(days=req.due_days)
    import uuid
    req_id = f"REQ-{now.year}-{int(now.timestamp()) % 10000:04d}-{uuid.uuid4().hex[:4].upper()}"
    
    new_req = MerchantInformationRequest(
        id=req_id,
        case_id=req.case_id,
        merchant_id=req.merchant_id,
        request_type=req.request_type,
        subject=req.subject,
        message=req.message,
        due_date=due_date,
        status="Sent",
        created_by_id=current_user.id,
        created_by_name=current_user.full_name,
        created_at=now
    )
    db.add(new_req)
    
    # Update case status
    case.status = "Pending Merchant Clarification"
    case.updated_at = now
    
    # Audit event
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="MERCHANT_REQUEST_SUBMIT",
        entity_type="MerchantInformationRequest",
        entity_id=new_req.id,
        before_state=None,
        after_state=json.dumps({"request_type": req.request_type, "subject": req.subject}),
        rationale=f"Dispatched inquiry to merchant {merchant.name} regarding {req.request_type}"
    ))
    db.commit()
    return {"status": "success", "request_id": new_req.id}

@router.post("/{request_id}/respond")
def submit_merchant_response(
    request_id: str,
    req: SubmitResponseInput,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Endpoint for Merchant-facing demo portal to submit response.
    """
    request_obj = db.query(MerchantInformationRequest).filter(
        MerchantInformationRequest.id == request_id
    ).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    response_obj = MerchantResponse(
        request_id=request_obj.id,
        merchant_id=request_obj.merchant_id,
        response_text=req.response_text,
        attachment_filenames=json.dumps(req.attachment_filenames or ["merchant_invoice_supporting.pdf"]),
        submitted_at=now,
        reviewer_verified=False
    )
    db.add(response_obj)
    
    # Update request status
    request_obj.status = "Responded"
    
    # Update case status if applicable
    case = db.query(Case).filter(Case.id == request_obj.case_id).first()
    if case and case.status == "Pending Merchant Clarification":
        case.status = "Under Investigation"
        case.updated_at = now
        
    # Audit log
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="MERCHANT_RESPONSE_SUBMIT",
        entity_type="MerchantResponse",
        entity_id=str(request_obj.id),
        before_state=None,
        after_state=json.dumps({"response_preview": req.response_text[:100]}),
        rationale="Merchant submitted written clarification response and supporting records."
    ))
    db.commit()
    return {"status": "success", "message": "Response submitted successfully."}
