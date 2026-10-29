from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.ai_service import (
    recommend_room_with_ai,
    chat_regulation_with_ai,
)

router = APIRouter()


class RoomRecommendationRequest(BaseModel):
    studentInfo: Dict[str, Any] = Field(..., description="Thông tin sinh viên và nguyện vọng phòng")
    candidateRooms: List[Dict[str, Any]] = Field(default_factory=list, description="Danh sách các phòng khả dụng")


class RoomRecommendationResponse(BaseModel):
    best_room_id: Optional[Any] = None
    toa: Optional[str] = None
    giuong: Optional[Any] = None
    match_score: int = 0
    ai_reason: str = ""


class ChatRegulationRequest(BaseModel):
    userMessage: str = Field(..., description="Câu hỏi hoặc tin nhắn của người dùng")
    conversationHistory: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Lịch sử đối thoại trước đó"
    )


class ChatRegulationResponse(BaseModel):
    reply: str
    source: str = "ai"


@router.post(
    "/recommend-room",
    response_model=RoomRecommendationResponse,
    summary="Gợi ý xếp phòng KTX dựa trên AI",
)
def api_recommend_room(data: RoomRecommendationRequest):
    """
    Nhận thông tin sinh viên và danh sách phòng trống,
    gọi Gemini AI (hoặc fallback thuật toán) để đưa ra phòng phù hợp nhất.
    """
    try:
        result = recommend_room_with_ai(
            student_info=data.studentInfo,
            candidate_rooms=data.candidateRooms,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi gợi ý xếp phòng bằng AI: {str(e)}",
        )


@router.post(
    "/chat-regulation",
    response_model=ChatRegulationResponse,
    summary="Chatbot tư vấn nội quy KTX với AI",
)
def api_chat_regulation(data: ChatRegulationRequest):
    """
    Nhận tin nhắn của sinh viên, nạp tài liệu nội quy chuẩn xác (ground truth)
    và gọi Gemini AI để tư vấn hỗ trợ sinh viên.
    """
    if not data.userMessage or not data.userMessage.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tin nhắn không được để trống.",
        )

    try:
        result = chat_regulation_with_ai(
            user_message=data.userMessage,
            conversation_history=data.conversationHistory,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý chatbot nội quy: {str(e)}",
        )
