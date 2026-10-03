from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    totalRevenue: float
    collectedRevenue: float
    collectionRate: float
    totalOutstanding: float
    overdueDebt: float
    reconciliationRate: float
    totalTransactions: int
    matchedTransactions: int
    unmatchedTransactions: int
    unpaidStudentsCount: int = 0


class PeriodRevenue(BaseModel):
    period: str
    roomFee: float
    utilityFee: float
    totalInvoiced: float
    totalCollected: float
    outstanding: float


class RoomTypeStat(BaseModel):
    roomType: str
    monthlyRate: float
    count: int
    totalReceivable: float
    totalCollected: float
    totalOutstanding: float


class ReconciliationBreakdown(BaseModel):
    autoMatched: int
    manualMatched: int
    invalidSyntax: int
    partialPaid: int
    pending: int


class RecentTransactionItem(BaseModel):
    id: str
    date: str
    amount: float
    content: str
    status: str
    statusText: str
    studentId: Optional[str] = None
    invoiceId: Optional[str] = None


class DashboardResponse(BaseModel):
    kpis: DashboardKPIs
    monthlyTrend: List[PeriodRevenue]
    roomTypeStats: List[RoomTypeStat]
    reconciliationBreakdown: ReconciliationBreakdown
    recentTransactions: List[RecentTransactionItem]


# =========================================================================
# BÁO CÁO TÀI CHÍNH (FINANCIAL REPORT) SCHEMAS
# =========================================================================

class FinancialSummary(BaseModel):
    totalInvoiced: float
    totalCollected: float
    totalOutstanding: float
    totalOverdue: float
    roomRevenueStandard: float
    roomRevenueService: float
    utilityRevenue: float
    collectionRate: float
    invoiceCount: int
    paidInvoiceCount: int
    unpaidStudentsCount: int = 0


class FinancialReportItem(BaseModel):
    invoiceId: str
    studentId: Optional[str] = None
    studentName: Optional[str] = None
    room: str
    roomType: str
    feeType: str
    period: str
    amount: float
    paid: float
    remaining: float
    status: str
    statusText: str
    issueDate: str
    dueDate: str
    matchedTxId: Optional[str] = None


class FinancialReportResponse(BaseModel):
    summary: FinancialSummary
    items: List[FinancialReportItem]


# =========================================================================
# BÁO CÁO THỐNG KÊ ĐỊNH KỲ (PERIODIC STATISTICAL REPORT) SCHEMAS
# =========================================================================

class PeriodicReportCreate(BaseModel):
    reportCode: Optional[str] = None
    title: str
    period: str
    reportType: str = "THANG"  # THANG, QUY, NAM, DOT_XUAT
    creatorName: str
    approverName: Optional[str] = None
    createdDate: Optional[str] = None
    notes: Optional[str] = None
    recommendations: Optional[str] = None
    summary: FinancialSummary
    items: Optional[List[FinancialReportItem]] = None


class PeriodicReportRecord(BaseModel):
    id: int
    reportCode: str
    title: str
    period: str
    reportType: str
    creatorName: str
    approverName: Optional[str] = None
    createdDate: str
    totalInvoiced: float
    totalCollected: float
    collectionRate: float
    totalOutstanding: float
    unpaidStudentsCount: int
    totalOverdue: float
    notes: Optional[str] = None
    recommendations: Optional[str] = None
    createdAt: str


class PeriodicReportListResponse(BaseModel):
    items: List[PeriodicReportRecord]
    total: int
