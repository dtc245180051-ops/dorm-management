from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TransactionStatistics(BaseModel):
    totalTransactions: int = Field(0, description="Tổng số giao dịch nhận")
    autoMatched: int = Field(0, description="Số lượng khớp tự động")
    manualRequired: int = Field(0, description="Số lượng cần xử lý tay")


class ReconciliationItemResponse(BaseModel):
    id: int
    bankTransactionCode: str
    transactionDate: str
    amount: float
    transferContent: str
    bankName: str
    bankAccount: Optional[str] = None
    status: str
    statusText: Optional[str] = None
    action: Optional[str] = None
    invoiceId: Optional[str] = None
    invoiceCode: Optional[str] = None
    invoiceDisplay: Optional[str] = None
    matched_invoice: Optional[str] = None
    matchedInvoice: Optional[str] = None
    displayMessage: Optional[str] = None
    studentId: Optional[str] = None
    studentCode: Optional[str] = None
    studentName: Optional[str] = None
    matchNote: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReconciliationListResponse(BaseModel):
    items: List[ReconciliationItemResponse]
    total: int
    page: int
    pageSize: int
    totalPages: int = 1
    statistics: TransactionStatistics


class StudentSearchItem(BaseModel):
    studentId: str
    studentCode: str
    studentName: str
    room: Optional[str] = None
    lop: Optional[str] = None


class StudentInvoiceItem(BaseModel):
    id: str
    invoiceCode: str
    description: str
    amount: float
    status: str
    dueDate: str


class UnpaidInvoiceItem(BaseModel):
    id: str
    invoiceCode: str
    invoiceType: str  # TIEN_PHONG or DIEN_NUOC
    invoiceTypeName: str
    targetName: str  # Tên SV hoặc Phòng
    room: Optional[str] = None
    msv: Optional[str] = None
    studentName: Optional[str] = None
    period: str
    amount: float
    status: str
    statusText: str
    dueDate: Optional[str] = None


class TransactionDetailResponse(BaseModel):
    transaction: ReconciliationItemResponse
    student: Optional[Dict[str, Any]] = None
    invoice: Optional[Dict[str, Any]] = None
    reconciliationStatus: str


class ManualMatchRequest(BaseModel):
    invoiceId: str = Field(..., description="Mã hóa đơn cần gán")
    studentId: Optional[str] = Field(None, description="Mã sinh viên hoặc ID sinh viên (nếu là tiền phòng)")


class ManualMatchResponse(BaseModel):
    success: bool
    message: str
    transactionId: Optional[str] = None
    invoiceCode: Optional[str] = None
    status: Optional[str] = None
    transaction: Optional[ReconciliationItemResponse] = None


class StatementUploadResponse(BaseModel):
    success: bool
    message: str
    fileName: str
    bankName: str
    period: str
    statistics: TransactionStatistics
    items: List[ReconciliationItemResponse]
    totalTransactions: int = 0
    autoMatched: int = 0
    manualRequired: int = 0
