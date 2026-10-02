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
