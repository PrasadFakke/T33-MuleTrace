from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.services.ai_chat_service import process_chat_query

router = APIRouter(prefix="/api/chat", tags=["AI Copilot"])

class ChatMessage(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None

@router.post("")
def chat_with_copilot(payload: ChatMessage):
    result = process_chat_query(payload.message, payload.history)
    return result
