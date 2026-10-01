from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class DebtStatistics(BaseModel):
    totalReceivable: float
    totalCollected: float
    totalOutstanding: float


class DebtItemResponse(BaseModel):
    studentId: str
    fullName: str
    room: str
    roomFeeDebt: float
    utilityFeeDebt: float
    totalDebt: float
    deadline: str
    isOverdue: bool = False


class DebtSummaryResponse(BaseModel):
    statistics: DebtStatistics
    items: List[DebtItemResponse]


class FeeItemResponse(BaseModel):
    id: str
    feeName: str
    period: str
    amount: float
    paidAmount: float
    remainingAmount: float
    status: str  # "Chưa nộp", "Đã hoàn tất", "Chuyển thiếu"
    deadline: Optional[str] = None
    isOverdue: bool = False


class PersonalDebtResponse(BaseModel):
    studentId: str
    fullName: str
    room: str
    phone: str
    totalDebt: float
    fees: List[FeeItemResponse]


class RemindDebtResponse(BaseModel):
    success: bool
    message: str
