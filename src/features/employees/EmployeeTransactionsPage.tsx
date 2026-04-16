import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeTransaction, RecipientAccount, TransactionFile } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { isNonPositive, parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { periodFromDate } from '../../shared/fiscalPeriod'

type EffectDirection = EmployeeTransaction['employee_balance_effect']
type TransactionKind = EmployeeTransaction['entry_kind']

type FileDraft = {
  file_name: string
  file_url: string
  mime_type: string
}

type Draft = {
  transaction_name: string
  employee_id: string
  entry_kind: TransactionKind
  txn_date: string
  from_account_id: string
  to_account_id: string
  payment_method: string
  amount_currency: 'USD' | 'INR'
  amount_inr: string
  exchange_rate: string
  amount_usd: string
  employee_balance_effect: EffectDirection
  employer_profitability_effect: EffectDirection
  settlement_group_id: string
  parent_transaction_id: string
  layer_order: string
  expected_commission_percent: string
  actual_commission_percent: string
  expected_commission_amount_usd: string
  actual_commission_amount_usd: string
  description: string
  notes: string
  transactionScreenshot: FileDraft
  confirmationScreenshot: FileDraft
  supportingFiles: FileDraft[]
}

type LinkRow = {
  transaction_id: string
  file_id: string
  file_role: 'TRANSACTION_SCREENSHOT' | 'CONFIRMATION_SCREENSHOT' | 'SUPPORTING_DOCUMENT'
}

type SettlementSummaryRow = {
  groupId: string
  sourceAccount: string
  targetAccount: string
  throughAccounts: string
  sourcePaidUsd: number
  targetReceivedUsd: number
  expectedCommissionUsd: number
  actualCommissionUsd: number
}

const EDITABLE_KINDS: TransactionKind[] = [
  'EXPENSE_DEDUCTION',
  'EXPENSE_REIMBURSEMENT',
  'MANUAL_CREDIT',
  'MANUAL_DEBIT',
  'PAYMENT_TO_EMPLOYEE',
  'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT',
  'EMPLOYEE_PAYROLL_CHECK',
  'PAYROLL_AMENDMENT_FEES',
  'EMPLOYER_TAX_FULL_PAYROLL',
  'EMPLOYER_TAX_LCA_DEFICIENCY',
  'CANDIDATE_PAYMENT_INDIA',
  'CANDIDATE_REPAYMENT_INDIA',
  'HEALTH_INSURANCE_DEDUCTION',
  'H1B_AMENDMENT_FILING_FEES',
  'H1B_AMENDMENT_ATTORNEY_FEES',
  'H1B_AMENDMENT_EXTENSION_FILING_FEES',
  'H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES',
  'H4_FILING_FEES',
  'H4_ATTORNEY_FEES',
  'H4_EAD_FILING_FEES',
  'H4_EAD_ATTORNEY_FEES',
]

const FALLBACK_PAYMENT_METHODS = [
  { code: 'ZELLE', label: 'Zelle' },
  { code: 'US_BANK_TO_US_BANK', label: 'US Bank to US Bank' },
  { code: 'US_BANK_TO_INDIA_BANK', label: 'US Bank to India Bank' },
  { code: 'INDIA_BANK_TO_INDIA_BANK', label: 'India Bank to India Bank' },
  { code: 'ACH', label: 'ACH' },
  { code: 'WIRE', label: 'Wire Transfer' },
  { code: 'CHECK', label: 'Check' },
  { code: 'CASH', label: 'Cash' },
]

function emptyFileDraft(): FileDraft {
  return { file_name: '', file_url: '', mime_type: '' }
}

function defaultEffectsForKind(kind: TransactionKind): { employee_balance_effect: EffectDirection; employer_profitability_effect: EffectDirection } {
  switch (kind) {
    case 'EMPLOYEE_EARNINGS':
      return { employee_balance_effect: 'ADD', employer_profitability_effect: 'SUBTRACT' }
    case 'EXPENSE_DEDUCTION':
      return { employee_balance_effect: 'SUBTRACT', employer_profitability_effect: 'ADD' }
    case 'EXPENSE_REIMBURSEMENT':
      return { employee_balance_effect: 'ADD', employer_profitability_effect: 'SUBTRACT' }
    case 'MANUAL_CREDIT':
      return { employee_balance_effect: 'ADD', employer_profitability_effect: 'SUBTRACT' }
    case 'MANUAL_DEBIT':
      return { employee_balance_effect: 'SUBTRACT', employer_profitability_effect: 'ADD' }
    case 'PAYMENT_TO_EMPLOYEE':
      return { employee_balance_effect: 'SUBTRACT', employer_profitability_effect: 'ADD' }
    case 'CANDIDATE_REPAYMENT_INDIA':
      return { employee_balance_effect: 'ADD', employer_profitability_effect: 'ADD' }
    case 'HEALTH_INSURANCE_DEDUCTION':
      return { employee_balance_effect: 'SUBTRACT', employer_profitability_effect: 'ADD' }
    default:
      return { employee_balance_effect: 'SUBTRACT', employer_profitability_effect: 'SUBTRACT' }
  }
}

function emptyDraft(yearMonth: string): Draft {
  const defaults = defaultEffectsForKind('EMPLOYEE_PAYROLL_DIRECT_DEPOSIT')
  return {
    transaction_name: '',
    employee_id: '',
    entry_kind: 'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT',
    txn_date: `${yearMonth}-15`,
    from_account_id: '',
    to_account_id: '',
    payment_method: 'ZELLE',
    amount_currency: 'USD',
    amount_inr: '',
    exchange_rate: '',
    amount_usd: '',
    employee_balance_effect: defaults.employee_balance_effect,
    employer_profitability_effect: defaults.employer_profitability_effect,
    settlement_group_id: '',
    parent_transaction_id: '',
    layer_order: '1',
    expected_commission_percent: '',
    actual_commission_percent: '',
    expected_commission_amount_usd: '',
    actual_commission_amount_usd: '',
    description: '',
    notes: '',
    transactionScreenshot: emptyFileDraft(),
    confirmationScreenshot: emptyFileDraft(),
    supportingFiles: [],
  }
}

function kindLabel(kind: string, getOptions: (c: string) => { code: string; label: string }[]) {
  return getOptions('employee_transaction_kind').find((o) => o.code === kind)?.label ?? kind.replace(/_/g, ' ')
}

function sourceLabelByKind(kind: TransactionKind): string {
  if (kind === 'EMPLOYEE_EARNINGS') return 'Timesheet'
  if (kind === 'EXPENSE_DEDUCTION' || kind === 'EXPENSE_REIMBURSEMENT') return 'Expense'
  return 'Manual'
}

function effectBadge(effect: EffectDirection) {
  return effect === 'ADD' ? '+ Add' : '- Subtract'
}

function signedImpact(amount: number, effect: EffectDirection) {
  return effect === 'ADD' ? amount : -amount
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function parseOptional(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return parseNumber(trimmed)
}

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fileNameFromUrl(url: string): string {
  const clean = url.trim().split('?')[0]
  const parts = clean.split('/')
  return parts[parts.length - 1] || 'proof-file'
}

function computeDraftUsd(draft: Draft): number {
  if (draft.amount_currency === 'INR') {
    const inr = parseNumber(draft.amount_inr)
    const rate = parseNumber(draft.exchange_rate)
    if (inr > 0 && rate > 0) return round2(inr / rate)
    return 0
  }
  return round2(parseNumber(draft.amount_usd))
}

function normalizeDraft(yearMonth: string, draft: Draft, showError: (msg: string) => void) {
  if (!draft.transaction_name.trim()) {
    showError('Transaction name is required.')
    return null
  }
  if (!draft.employee_id) {
    showError('Select an employee.')
    return null
  }

  const txnDate = draft.txn_date || `${yearMonth}-15`
  const periodMonth = periodFromDate(txnDate)

  if (draft.entry_kind !== 'EMPLOYEE_EARNINGS') {
    if (!draft.from_account_id) {
      showError('Select from account.')
      return null
    }
    if (!draft.to_account_id) {
      showError('Select to account.')
      return null
    }
  }

  let amountInr: number | null = null
  let exchangeRate: number | null = null
  let amountUsd = 0

  if (draft.amount_currency === 'INR') {
    amountInr = parseNumber(draft.amount_inr)
    exchangeRate = parseNumber(draft.exchange_rate)
    if (isNonPositive(amountInr)) {
      showError('INR amount must be greater than 0.')
      return null
    }
    if (isNonPositive(exchangeRate)) {
      showError('Exchange rate must be greater than 0.')
      return null
    }
    amountUsd = round2(amountInr / exchangeRate)
  } else {
    amountUsd = parseNumber(draft.amount_usd)
    if (isNonPositive(amountUsd)) {
      showError('USD amount must be greater than 0.')
      return null
    }
  }

  const layerOrder = Math.max(1, Math.floor(parseNumber(draft.layer_order || '1')))

  const normalized = {
    txnDate,
    periodMonth,
    amountInr,
    exchangeRate,
    amountUsd,
    layerOrder,
    expectedCommissionPercent: parseOptional(draft.expected_commission_percent),
    actualCommissionPercent: parseOptional(draft.actual_commission_percent),
    expectedCommissionAmountUsd: parseOptional(draft.expected_commission_amount_usd),
    actualCommissionAmountUsd: parseOptional(draft.actual_commission_amount_usd),
    description: draft.description.trim() || 'Employee transaction',
    notes: draft.notes.trim() || null,
    settlementGroupId: draft.settlement_group_id.trim() || null,
    parentTransactionId: draft.parent_transaction_id || null,
  }

  return normalized
}

export function EmployeeTransactionsPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [yearMonth, setYearMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterEmployeeId, setFilterEmployeeId] = useState('')

  const [rows, setRows] = useState<EmployeeTransaction[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accounts, setAccounts] = useState<RecipientAccount[]>([])
  const [fileMap, setFileMap] = useState<Record<string, TransactionFile>>({})
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDraft, setFormDraft] = useState<Draft>(() => emptyDraft(yearMonth))

  const periodMonthFilter = `${yearMonth}-01`

  const loadData = useCallback(async () => {
    if (!activeBusinessId) return

    let txQ = supabase
      .from('employee_transactions')
      .select(
        'id,business_id,employee_id,project_id,transaction_name,txn_date,period_month,entry_kind,amount,amount_currency,amount_inr,exchange_rate,amount_usd,from_account_id,to_account_id,payment_method,transaction_screenshot_id,confirmation_screenshot_id,settlement_group_id,parent_transaction_id,layer_order,expected_commission_percent,actual_commission_percent,expected_commission_amount_usd,actual_commission_amount_usd,description,notes,is_system_generated,employee_balance_effect,employer_profitability_effect,created_at,updated_at',
      )
      .eq('business_id', activeBusinessId)
      .eq('period_month', periodMonthFilter)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(700)

    if (filterEmployeeId) txQ = txQ.eq('employee_id', filterEmployeeId)

    const [empR, accR, txR] = await Promise.all([
      supabase
        .from('employees')
        .select('id,business_id,first_name,last_name,full_name,email,employee_type,overtime_pay_rate,holiday_pay_rate,holiday_ot_pay_rate,travel_reimbursement_rate,employer_tax_percent')
        .eq('business_id', activeBusinessId)
        .order('full_name'),
      supabase
        .from('recipient_accounts')
        .select('id,business_id,employee_id,account_name,account_type,payment_identifier,bank_name,country,currency,notes,is_active,created_at,updated_at')
        .eq('business_id', activeBusinessId)
        .eq('is_active', true)
        .order('account_name'),
      txQ,
    ])

    if (empR.error || accR.error || txR.error) {
      showError(empR.error?.message ?? accR.error?.message ?? txR.error?.message ?? 'Load failed')
      return
    }

    const txRows = (txR.data ?? []) as EmployeeTransaction[]

    setEmployees((empR.data ?? []) as Employee[])
    setAccounts((accR.data ?? []) as RecipientAccount[])
    setRows(txRows)

    const txIds = txRows.map((r) => r.id)
    const directFileIds = new Set<string>()
    for (const r of txRows) {
      if (r.transaction_screenshot_id) directFileIds.add(r.transaction_screenshot_id)
      if (r.confirmation_screenshot_id) directFileIds.add(r.confirmation_screenshot_id)
    }

    let linkRows: LinkRow[] = []
    if (txIds.length > 0) {
      const linksR = await supabase
        .from('employee_transaction_file_links')
        .select('transaction_id,file_id,file_role')
        .in('transaction_id', txIds)

      if (linksR.error) {
        showError(linksR.error.message)
        return
      }
      linkRows = (linksR.data ?? []) as LinkRow[]
      for (const l of linkRows) directFileIds.add(l.file_id)
    }

    const fileIds = Array.from(directFileIds)
    const fileRows: TransactionFile[] = []
    if (fileIds.length > 0) {
      const filesR = await supabase
        .from('transaction_files')
        .select('id,business_id,file_name,file_url,mime_type,uploaded_at')
        .in('id', fileIds)

      if (filesR.error) {
        showError(filesR.error.message)
        return
      }
      fileRows.push(...((filesR.data ?? []) as TransactionFile[]))
    }

    const nextFileMap: Record<string, TransactionFile> = {}
    for (const f of fileRows) nextFileMap[f.id] = f
    setFileMap(nextFileMap)

    const counts: Record<string, number> = {}
    for (const l of linkRows) counts[l.transaction_id] = (counts[l.transaction_id] ?? 0) + 1
    setAttachmentCounts(counts)
  }, [activeBusinessId, periodMonthFilter, filterEmployeeId, showError])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!editingId) setFormDraft(emptyDraft(yearMonth))
  }, [yearMonth, editingId])

  const accountMap = useMemo(() => {
    const map: Record<string, RecipientAccount> = {}
    for (const a of accounts) map[a.id] = a
    return map
  }, [accounts])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount_usd ?? row.amount ?? 0)
        acc.employeeBalance += signedImpact(amount, row.employee_balance_effect)
        acc.employerProfitability += signedImpact(amount, row.employer_profitability_effect)
        return acc
      },
      { employeeBalance: 0, employerProfitability: 0 },
    )
  }, [rows])

  const settlementSummary = useMemo(() => {
    const groups: Record<string, EmployeeTransaction[]> = {}
    for (const row of rows) {
      const groupId = row.settlement_group_id ?? row.id
      if (!groups[groupId]) groups[groupId] = []
      groups[groupId].push(row)
    }

    const summaries: SettlementSummaryRow[] = []
    for (const [groupId, txs] of Object.entries(groups)) {
      const outgoing = new Set<string>()
      const incoming = new Set<string>()
      for (const t of txs) {
        if (t.from_account_id) outgoing.add(t.from_account_id)
        if (t.to_account_id) incoming.add(t.to_account_id)
      }

      const sourceCandidates = Array.from(outgoing).filter((id) => !incoming.has(id))
      const targetCandidates = Array.from(incoming).filter((id) => !outgoing.has(id))

      const source = sourceCandidates[0] ?? txs.find((t) => !!t.from_account_id)?.from_account_id ?? ''
      const target = targetCandidates[0] ?? [...txs].reverse().find((t) => !!t.to_account_id)?.to_account_id ?? ''

      const through = new Set<string>()
      for (const t of txs) {
        if (t.from_account_id && t.from_account_id !== source && t.from_account_id !== target) through.add(t.from_account_id)
        if (t.to_account_id && t.to_account_id !== source && t.to_account_id !== target) through.add(t.to_account_id)
      }

      const sourcePaidUsd = txs
        .filter((t) => t.from_account_id === source)
        .reduce((sum, t) => sum + Number(t.amount_usd ?? t.amount ?? 0), 0)
      const targetReceivedUsd = txs
        .filter((t) => t.to_account_id === target)
        .reduce((sum, t) => sum + Number(t.amount_usd ?? t.amount ?? 0), 0)

      const expectedCommissionUsd = txs.reduce((sum, t) => {
        const amount = Number(t.amount_usd ?? t.amount ?? 0)
        if (t.expected_commission_amount_usd != null) return sum + Number(t.expected_commission_amount_usd)
        if (t.expected_commission_percent != null) return sum + (amount * Number(t.expected_commission_percent) / 100)
        return sum
      }, 0)

      const actualCommissionUsd = txs.reduce((sum, t) => {
        const amount = Number(t.amount_usd ?? t.amount ?? 0)
        if (t.actual_commission_amount_usd != null) return sum + Number(t.actual_commission_amount_usd)
        if (t.actual_commission_percent != null) return sum + (amount * Number(t.actual_commission_percent) / 100)
        return sum
      }, 0)

      summaries.push({
        groupId,
        sourceAccount: source,
        targetAccount: target,
        throughAccounts: Array.from(through).join(','),
        sourcePaidUsd: round2(sourcePaidUsd),
        targetReceivedUsd: round2(targetReceivedUsd),
        expectedCommissionUsd: round2(expectedCommissionUsd),
        actualCommissionUsd: round2(actualCommissionUsd),
      })
    }

    return summaries
  }, [rows])

  const paymentMethodOptions = getOptions('transaction_payment_method').length
    ? getOptions('transaction_payment_method')
    : FALLBACK_PAYMENT_METHODS

  async function createFileRecord(file: FileDraft): Promise<string | null> {
    if (!activeBusinessId) return null
    const url = file.file_url.trim()
    if (!url) return null

    const payload = {
      business_id: activeBusinessId,
      file_name: file.file_name.trim() || fileNameFromUrl(url),
      file_url: url,
      mime_type: file.mime_type.trim() || null,
    }

    const { data, error } = await supabase
      .from('transaction_files')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      throw new Error(error.message)
    }
    return data.id
  }

  function startCreate() {
    clearNotice()
    setEditingId(null)
    setFormDraft(emptyDraft(yearMonth))
  }

  function startEdit(row: EmployeeTransaction) {
    if (row.is_system_generated) return
    clearNotice()
    setEditingId(row.id)
    setFormDraft({
      transaction_name: row.transaction_name,
      employee_id: row.employee_id,
      entry_kind: row.entry_kind,
      txn_date: row.txn_date,
      from_account_id: row.from_account_id ?? '',
      to_account_id: row.to_account_id ?? '',
      payment_method: row.payment_method ?? '',
      amount_currency: row.amount_currency,
      amount_inr: row.amount_inr != null ? String(row.amount_inr) : '',
      exchange_rate: row.exchange_rate != null ? String(row.exchange_rate) : '',
      amount_usd: String(row.amount_usd ?? row.amount),
      employee_balance_effect: row.employee_balance_effect,
      employer_profitability_effect: row.employer_profitability_effect,
      settlement_group_id: row.settlement_group_id ?? '',
      parent_transaction_id: row.parent_transaction_id ?? '',
      layer_order: String(row.layer_order ?? 1),
      expected_commission_percent: row.expected_commission_percent != null ? String(row.expected_commission_percent) : '',
      actual_commission_percent: row.actual_commission_percent != null ? String(row.actual_commission_percent) : '',
      expected_commission_amount_usd: row.expected_commission_amount_usd != null ? String(row.expected_commission_amount_usd) : '',
      actual_commission_amount_usd: row.actual_commission_amount_usd != null ? String(row.actual_commission_amount_usd) : '',
      description: row.description,
      notes: row.notes ?? '',
      transactionScreenshot: emptyFileDraft(),
      confirmationScreenshot: emptyFileDraft(),
      supportingFiles: [],
    })
  }

  function addSupportingFileRow() {
    setFormDraft((d) => ({ ...d, supportingFiles: [...d.supportingFiles, emptyFileDraft()] }))
  }

  function updateSupportingFile(index: number, field: keyof FileDraft, value: string) {
    setFormDraft((d) => {
      const next = [...d.supportingFiles]
      next[index] = { ...next[index], [field]: value }
      return { ...d, supportingFiles: next }
    })
  }

  function removeSupportingFile(index: number) {
    setFormDraft((d) => ({ ...d, supportingFiles: d.supportingFiles.filter((_, i) => i !== index) }))
  }

  async function saveForm() {
    if (!activeBusinessId) return
    clearNotice()

    const normalized = normalizeDraft(yearMonth, formDraft, showError)
    if (!normalized) return

    let screenshotId: string | null = null
    let confirmationId: string | null = null

    const editingRow = editingId ? rows.find((r) => r.id === editingId) ?? null : null
    if (editingRow) {
      screenshotId = editingRow.transaction_screenshot_id
      confirmationId = editingRow.confirmation_screenshot_id
    }

    try {
      const maybeShot = await createFileRecord(formDraft.transactionScreenshot)
      if (maybeShot) screenshotId = maybeShot
      const maybeConfirm = await createFileRecord(formDraft.confirmationScreenshot)
      if (maybeConfirm) confirmationId = maybeConfirm
    } catch (error) {
      showError((error as Error).message)
      return
    }

    const basePayload = {
      business_id: activeBusinessId,
      employee_id: formDraft.employee_id,
      project_id: null,
      transaction_name: formDraft.transaction_name.trim(),
      txn_date: normalized.txnDate,
      period_month: normalized.periodMonth,
      entry_kind: formDraft.entry_kind,
      amount: normalized.amountUsd,
      amount_currency: formDraft.amount_currency,
      amount_inr: normalized.amountInr,
      exchange_rate: normalized.exchangeRate,
      amount_usd: normalized.amountUsd,
      from_account_id: formDraft.from_account_id || null,
      to_account_id: formDraft.to_account_id || null,
      payment_method: formDraft.payment_method.trim() || null,
      transaction_screenshot_id: screenshotId,
      confirmation_screenshot_id: confirmationId,
      settlement_group_id: normalized.settlementGroupId,
      parent_transaction_id: normalized.parentTransactionId,
      layer_order: normalized.layerOrder,
      expected_commission_percent: normalized.expectedCommissionPercent,
      actual_commission_percent: normalized.actualCommissionPercent,
      expected_commission_amount_usd: normalized.expectedCommissionAmountUsd,
      actual_commission_amount_usd: normalized.actualCommissionAmountUsd,
      description: normalized.description,
      notes: normalized.notes,
      employee_balance_effect: formDraft.employee_balance_effect,
      employer_profitability_effect: formDraft.employer_profitability_effect,
    }

    let transactionId = editingId

    if (editingId) {
      const { error } = await supabase
        .from('employee_transactions')
        .update({ ...basePayload, updated_at: new Date().toISOString() })
        .eq('id', editingId)
        .eq('is_system_generated', false)

      if (error) {
        showError(error.message)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('employee_transactions')
        .insert({ ...basePayload, is_system_generated: false })
        .select('id')
        .single()

      if (error) {
        showError(error.message)
        return
      }
      transactionId = data.id
    }

    if (!transactionId) {
      showError('Unable to save transaction.')
      return
    }

    if (screenshotId || confirmationId) {
      await supabase
        .from('employee_transaction_file_links')
        .delete()
        .eq('transaction_id', transactionId)
        .in('file_role', ['TRANSACTION_SCREENSHOT', 'CONFIRMATION_SCREENSHOT'])

      const fixedLinks: { transaction_id: string; file_id: string; file_role: 'TRANSACTION_SCREENSHOT' | 'CONFIRMATION_SCREENSHOT' }[] = []
      if (screenshotId) fixedLinks.push({ transaction_id: transactionId, file_id: screenshotId, file_role: 'TRANSACTION_SCREENSHOT' })
      if (confirmationId) fixedLinks.push({ transaction_id: transactionId, file_id: confirmationId, file_role: 'CONFIRMATION_SCREENSHOT' })
      if (fixedLinks.length) {
        const { error } = await supabase.from('employee_transaction_file_links').insert(fixedLinks)
        if (error) {
          showError(error.message)
          return
        }
      }
    }

    const extraLinks: { transaction_id: string; file_id: string; file_role: 'SUPPORTING_DOCUMENT' }[] = []
    for (const file of formDraft.supportingFiles) {
      if (!file.file_url.trim()) continue
      try {
        const id = await createFileRecord(file)
        if (id) extraLinks.push({ transaction_id: transactionId, file_id: id, file_role: 'SUPPORTING_DOCUMENT' })
      } catch (error) {
        showError((error as Error).message)
        return
      }
    }

    if (extraLinks.length) {
      const { error } = await supabase.from('employee_transaction_file_links').insert(extraLinks)
      if (error) {
        showError(error.message)
        return
      }
    }

    setEditingId(null)
    setFormDraft(emptyDraft(yearMonth))
    await loadData()
    showSuccess(editingId ? 'Transaction updated.' : 'Transaction added.')
  }

  async function deleteRow(row: EmployeeTransaction) {
    if (row.is_system_generated) return
    if (!confirmAction('Delete this transaction?')) return

    const { error } = await supabase
      .from('employee_transactions')
      .delete()
      .eq('id', row.id)
      .eq('is_system_generated', false)

    if (error) {
      showError(error.message)
      return
    }

    if (editingId === row.id) {
      setEditingId(null)
      setFormDraft(emptyDraft(yearMonth))
    }

    await loadData()
    showSuccess('Transaction deleted.')
  }

  function empName(id: string) {
    return employees.find((x) => x.id === id)?.full_name ?? id
  }

  function accountName(id: string | null) {
    if (!id) return '—'
    const a = accountMap[id]
    return a ? a.account_name : id
  }

  const computedUsd = computeDraftUsd(formDraft)

  if (!activeBusinessId) {
    return <p className="text-muted">Select a business first.</p>
  }

  return (
    <>
      <PageSection
        title="Employee Transactions"
        actions={
          <div className="flex-row gap-xs">
            <button type="button" className="btn-primary btn-sm" onClick={() => startCreate()}>
              + New transaction
            </button>
            {editingId && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => { setEditingId(null); setFormDraft(emptyDraft(yearMonth)) }}>
                Cancel edit
              </button>
            )}
          </div>
        }
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Supports multi-layer routing (A to B through C,D,E), commission variance tracking, account-level routing,
          payment method capture, INR to USD conversion with exchange rate, and proof document links.
        </p>

        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <FormField label="Period (month)">
            <input type="month" value={yearMonth} onChange={(ev) => setYearMonth(ev.target.value)} />
          </FormField>
          <FormField label="Employee filter">
            <select value={filterEmployeeId} onChange={(ev) => setFilterEmployeeId(ev.target.value)}>
              <option value="">All employees</option>
              {employees.map((em) => <option key={em.id} value={em.id}>{em.full_name}</option>)}
            </select>
          </FormField>
        </div>

        <form
          className="form-grid"
          style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-accent-light)', borderRadius: 'var(--radius-md)' }}
          onSubmit={(e) => {
            e.preventDefault()
            saveForm()
          }}
        >
          <h3 style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.95rem' }}>
            {editingId ? 'Edit transaction' : 'Add transaction'}
          </h3>

          <FormField label="Name of transaction">
            <input value={formDraft.transaction_name} onChange={(e) => setFormDraft((d) => ({ ...d, transaction_name: e.target.value }))} required />
          </FormField>

          <FormField label="Type of transaction">
            <select
              value={formDraft.entry_kind}
              onChange={(e) => {
                const kind = e.target.value as TransactionKind
                const defaults = defaultEffectsForKind(kind)
                setFormDraft((d) => ({
                  ...d,
                  entry_kind: kind,
                  employee_balance_effect: defaults.employee_balance_effect,
                  employer_profitability_effect: defaults.employer_profitability_effect,
                }))
              }}
            >
              {EDITABLE_KINDS.map((kind) => <option key={kind} value={kind}>{kindLabel(kind, getOptions)}</option>)}
            </select>
          </FormField>

          <FormField label="Transaction date">
            <input type="date" value={formDraft.txn_date} onChange={(e) => setFormDraft((d) => ({ ...d, txn_date: e.target.value }))} required />
          </FormField>

          <FormField label="Employee">
            <select value={formDraft.employee_id} onChange={(e) => setFormDraft((d) => ({ ...d, employee_id: e.target.value }))} required>
              <option value="">Select</option>
              {employees.map((em) => <option key={em.id} value={em.id}>{em.full_name}</option>)}
            </select>
          </FormField>

          <FormField label="From account">
            <select value={formDraft.from_account_id} onChange={(e) => setFormDraft((d) => ({ ...d, from_account_id: e.target.value }))}>
              <option value="">Select</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </select>
          </FormField>

          <FormField label="To account">
            <select value={formDraft.to_account_id} onChange={(e) => setFormDraft((d) => ({ ...d, to_account_id: e.target.value }))}>
              <option value="">Select</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </select>
          </FormField>

          <FormField label="Payment method">
            <select value={formDraft.payment_method} onChange={(e) => setFormDraft((d) => ({ ...d, payment_method: e.target.value }))}>
              <option value="">Select</option>
              {paymentMethodOptions.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
          </FormField>

          <FormField label="Amount currency">
            <select value={formDraft.amount_currency} onChange={(e) => setFormDraft((d) => ({ ...d, amount_currency: e.target.value as 'USD' | 'INR' }))}>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </FormField>

          {formDraft.amount_currency === 'INR' ? (
            <>
              <FormField label="Amount (INR)">
                <input type="number" min="0.01" step="0.01" value={formDraft.amount_inr} onChange={(e) => setFormDraft((d) => ({ ...d, amount_inr: e.target.value }))} />
              </FormField>
              <FormField label="Exchange rate">
                <input type="number" min="0.000001" step="0.000001" value={formDraft.exchange_rate} onChange={(e) => setFormDraft((d) => ({ ...d, exchange_rate: e.target.value }))} />
              </FormField>
              <FormField label="Amount (USD auto)">
                <input value={computedUsd ? String(computedUsd) : ''} readOnly />
              </FormField>
            </>
          ) : (
            <FormField label="Amount (USD)">
              <input type="number" min="0.01" step="0.01" value={formDraft.amount_usd} onChange={(e) => setFormDraft((d) => ({ ...d, amount_usd: e.target.value }))} />
            </FormField>
          )}

          <FormField label="Employee balance calc">
            <select value={formDraft.employee_balance_effect} onChange={(e) => setFormDraft((d) => ({ ...d, employee_balance_effect: e.target.value as EffectDirection }))}>
              <option value="ADD">Add</option>
              <option value="SUBTRACT">Subtract</option>
            </select>
          </FormField>

          <FormField label="Employer profitability calc">
            <select value={formDraft.employer_profitability_effect} onChange={(e) => setFormDraft((d) => ({ ...d, employer_profitability_effect: e.target.value as EffectDirection }))}>
              <option value="ADD">Add</option>
              <option value="SUBTRACT">Subtract</option>
            </select>
          </FormField>

          <FormField label="Settlement group ID (multi-layer)">
            <input value={formDraft.settlement_group_id} onChange={(e) => setFormDraft((d) => ({ ...d, settlement_group_id: e.target.value }))} placeholder="Optional UUID to group related legs" />
          </FormField>

          <FormField label="Parent transaction leg">
            <select value={formDraft.parent_transaction_id} onChange={(e) => setFormDraft((d) => ({ ...d, parent_transaction_id: e.target.value }))}>
              <option value="">None</option>
              {rows.filter((r) => r.id !== editingId).map((r) => (
                <option key={r.id} value={r.id}>{r.transaction_name} ({r.txn_date})</option>
              ))}
            </select>
          </FormField>

          <FormField label="Layer order">
            <input type="number" min="1" step="1" value={formDraft.layer_order} onChange={(e) => setFormDraft((d) => ({ ...d, layer_order: e.target.value }))} />
          </FormField>

          <FormField label="Expected commission %">
            <input type="number" min="0" step="0.0001" value={formDraft.expected_commission_percent} onChange={(e) => setFormDraft((d) => ({ ...d, expected_commission_percent: e.target.value }))} />
          </FormField>

          <FormField label="Actual commission %">
            <input type="number" min="0" step="0.0001" value={formDraft.actual_commission_percent} onChange={(e) => setFormDraft((d) => ({ ...d, actual_commission_percent: e.target.value }))} />
          </FormField>

          <FormField label="Expected commission USD">
            <input type="number" min="0" step="0.01" value={formDraft.expected_commission_amount_usd} onChange={(e) => setFormDraft((d) => ({ ...d, expected_commission_amount_usd: e.target.value }))} />
          </FormField>

          <FormField label="Actual commission USD">
            <input type="number" min="0" step="0.01" value={formDraft.actual_commission_amount_usd} onChange={(e) => setFormDraft((d) => ({ ...d, actual_commission_amount_usd: e.target.value }))} />
          </FormField>

          <FormField label="Description">
            <input value={formDraft.description} onChange={(e) => setFormDraft((d) => ({ ...d, description: e.target.value }))} />
          </FormField>

          <FormField label="Notes">
            <input value={formDraft.notes} onChange={(e) => setFormDraft((d) => ({ ...d, notes: e.target.value }))} />
          </FormField>

          <FormField label="Transaction screenshot name">
            <input value={formDraft.transactionScreenshot.file_name} onChange={(e) => setFormDraft((d) => ({ ...d, transactionScreenshot: { ...d.transactionScreenshot, file_name: e.target.value } }))} />
          </FormField>

          <FormField label="Transaction screenshot URL">
            <input value={formDraft.transactionScreenshot.file_url} onChange={(e) => setFormDraft((d) => ({ ...d, transactionScreenshot: { ...d.transactionScreenshot, file_url: e.target.value } }))} placeholder="https://..." />
          </FormField>

          <FormField label="Confirmation screenshot name">
            <input value={formDraft.confirmationScreenshot.file_name} onChange={(e) => setFormDraft((d) => ({ ...d, confirmationScreenshot: { ...d.confirmationScreenshot, file_name: e.target.value } }))} />
          </FormField>

          <FormField label="Confirmation screenshot URL">
            <input value={formDraft.confirmationScreenshot.file_url} onChange={(e) => setFormDraft((d) => ({ ...d, confirmationScreenshot: { ...d.confirmationScreenshot, file_url: e.target.value } }))} placeholder="https://..." />
          </FormField>

          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={addSupportingFileRow}>+ Add supporting proof</button>
          </div>

          {formDraft.supportingFiles.map((f, i) => (
            <div key={`support-${i}`} className="form-grid" style={{ gridColumn: '1 / -1', padding: '0.5rem', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-sm)' }}>
              <FormField label={`Support file ${i + 1} name`}>
                <input value={f.file_name} onChange={(e) => updateSupportingFile(i, 'file_name', e.target.value)} />
              </FormField>
              <FormField label={`Support file ${i + 1} URL`}>
                <input value={f.file_url} onChange={(e) => updateSupportingFile(i, 'file_url', e.target.value)} placeholder="https://..." />
              </FormField>
              <FormField label="MIME type (optional)">
                <input value={f.mime_type} onChange={(e) => updateSupportingFile(i, 'mime_type', e.target.value)} placeholder="image/png, application/pdf" />
              </FormField>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn-danger btn-sm" onClick={() => removeSupportingFile(i)}>Remove</button>
              </div>
            </div>
          ))}

          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary">{editingId ? 'Save changes' : 'Add transaction'}</button>
          </div>
        </form>

        <NoticeBanner message={message} type={type} />

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
                <th>Employee</th>
                <th>From</th>
                <th>To</th>
                <th>Method</th>
                <th>INR</th>
                <th>FX</th>
                <th>USD</th>
                <th>Employee Calc</th>
                <th>Employer Calc</th>
                <th>Group / Layer</th>
                <th>Commission (Exp / Act)</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.txn_date}</td>
                  <td style={{ fontWeight: 600 }}>{row.transaction_name}</td>
                  <td><span className="badge badge-neutral">{kindLabel(row.entry_kind, getOptions)}</span></td>
                  <td>{empName(row.employee_id)}</td>
                  <td>{accountName(row.from_account_id)}</td>
                  <td>{accountName(row.to_account_id)}</td>
                  <td>{row.payment_method ?? '—'}</td>
                  <td>{row.amount_inr != null ? row.amount_inr.toLocaleString('en-US') : '—'}</td>
                  <td>{row.exchange_rate != null ? row.exchange_rate.toFixed(4) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(Number(row.amount_usd ?? row.amount ?? 0))}</td>
                  <td><span className="badge badge-neutral">{effectBadge(row.employee_balance_effect)}</span></td>
                  <td><span className="badge badge-neutral">{effectBadge(row.employer_profitability_effect)}</span></td>
                  <td style={{ fontSize: '0.78rem' }}>{row.settlement_group_id ?? '—'} / {row.layer_order}</td>
                  <td style={{ fontSize: '0.78rem' }}>
                    {row.expected_commission_amount_usd != null || row.expected_commission_percent != null ? (
                      <span>E: {row.expected_commission_amount_usd != null ? money(Number(row.expected_commission_amount_usd)) : `${row.expected_commission_percent}%`}</span>
                    ) : 'E: —'}
                    <br />
                    {row.actual_commission_amount_usd != null || row.actual_commission_percent != null ? (
                      <span>A: {row.actual_commission_amount_usd != null ? money(Number(row.actual_commission_amount_usd)) : `${row.actual_commission_percent}%`}</span>
                    ) : 'A: —'}
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>
                    Txn: {row.transaction_screenshot_id && fileMap[row.transaction_screenshot_id] ? <a href={fileMap[row.transaction_screenshot_id].file_url} target="_blank" rel="noreferrer">View</a> : '—'}
                    <br />
                    Cfm: {row.confirmation_screenshot_id && fileMap[row.confirmation_screenshot_id] ? <a href={fileMap[row.confirmation_screenshot_id].file_url} target="_blank" rel="noreferrer">View</a> : '—'}
                    <br />
                    Docs: {attachmentCounts[row.id] ?? 0}
                  </td>
                  <td>
                    {!row.is_system_generated ? (
                      <div className="flex-row gap-xs" style={{ display: 'inline-flex' }}>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(row)}>Edit</button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteRow(row)}>Delete</button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{sourceLabelByKind(row.entry_kind)}</span>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                    No transactions for this period{filterEmployeeId ? ' and employee' : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <strong>Employee Balance Net: </strong>
                <span style={{ fontWeight: 700, color: totals.employeeBalance >= 0 ? 'var(--color-primary)' : '#b42318' }}>
                  {totals.employeeBalance >= 0 ? '+' : ''}{money(totals.employeeBalance)}
                </span>
              </div>
              <div>
                <strong>Employer Profitability Impact: </strong>
                <span style={{ fontWeight: 700, color: totals.employerProfitability >= 0 ? 'var(--color-success)' : '#b42318' }}>
                  {totals.employerProfitability >= 0 ? '+' : ''}{money(totals.employerProfitability)}
                </span>
              </div>
            </div>
          </div>
        )}
      </PageSection>

      <PageSection title="Multi-layer Settlement Summary">
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Summary of A paying B through intermediaries (C / C,D,E), including expected vs actual commission and variance.
        </p>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Group ID</th>
                <th>Source (A)</th>
                <th>Target (B)</th>
                <th>Through</th>
                <th style={{ textAlign: 'right' }}>A Paid (USD)</th>
                <th style={{ textAlign: 'right' }}>B Received (USD)</th>
                <th style={{ textAlign: 'right' }}>Expected Comm</th>
                <th style={{ textAlign: 'right' }}>Actual Comm</th>
                <th style={{ textAlign: 'right' }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {settlementSummary.map((s) => (
                <tr key={s.groupId}>
                  <td style={{ fontSize: '0.78rem' }}>{s.groupId}</td>
                  <td>{accountName(s.sourceAccount || null)}</td>
                  <td>{accountName(s.targetAccount || null)}</td>
                  <td>{s.throughAccounts ? s.throughAccounts.split(',').map((id) => accountName(id)).join(', ') : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.sourcePaidUsd)}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.targetReceivedUsd)}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.expectedCommissionUsd)}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.actualCommissionUsd)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(round2(s.actualCommissionUsd - s.expectedCommissionUsd))}</td>
                </tr>
              ))}
              {settlementSummary.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                    No grouped settlements in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </>
  )
}
