
'use client'

import useSWR from 'swr'
import { useState, useEffect } from 'react'

interface FinanceDataOptions {
  period?: string
  page?: number
  pageSize?: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useFinanceData(options: FinanceDataOptions = {}) {
  const { period = 'all', page = 1, pageSize = 10000 } = options
  
  // Customer Invoices
  const { data: customerInvoicesData, error: customerInvoicesError, isLoading: customerInvoicesLoading } = useSWR(
    `/api/finance/customer-invoices?page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  // Supplier Invoices
  const { data: supplierInvoicesData, error: supplierInvoicesError, isLoading: supplierInvoicesLoading } = useSWR(
    `/api/finance/supplier-invoices?page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  // Payments
  const { data: paymentsData, error: paymentsError, isLoading: paymentsLoading } = useSWR(
    `/api/finance/payments?page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  // Purchase Orders
  const { data: purchaseOrdersData, error: purchaseOrdersError, isLoading: purchaseOrdersLoading } = useSWR(
    `/api/finance/purchase-orders`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  const isLoading = customerInvoicesLoading || supplierInvoicesLoading || paymentsLoading || purchaseOrdersLoading
  const hasError = customerInvoicesError || supplierInvoicesError || paymentsError || purchaseOrdersError

  return {
    customerInvoices: customerInvoicesData?.invoices || [],
    customerInvoicesPagination: customerInvoicesData?.pagination || {},
    supplierInvoices: supplierInvoicesData?.invoices || [],
    supplierInvoicesPagination: supplierInvoicesData?.pagination || {},
    payments: paymentsData?.payments || [],
    paymentsPagination: paymentsData?.pagination || {},
    purchaseOrders: Array.isArray(purchaseOrdersData) ? purchaseOrdersData : [],
    isLoading,
    hasError
  }
}
