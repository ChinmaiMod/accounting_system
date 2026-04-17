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

type EffectDirection = 'ADD' | 'SUBTRACT'
type TransactionKind = EmployeeTransaction['entry_kind']

type FileDraft = {
  file_name: string
  file_url: string
  mime_type: string
}

type RowDraft = {
  id: string
  isNew: boolean
  isSystem: boolean
  existingScreenshotId: string | null
  existingConfirmationId: string | null
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

const cellInp: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  padding: '0.4rem 0.45rem',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

let tempIdCounter = 0
function nextTempId() {
  tempIdCounter += 1
  return `new-${tempIdCounter}-${Date.now()}`
}

function emptyFileDraft(): FileDraft {
  return { file_name: '', file_url: '', mime_type: '' }
}

function emptyDraft(yearMonth: string): RowDraft {
  return {
    id: nextTempId(),
    isNew: true,
    isSystem: false,
    existingScreenshotId: null,
    existingConfirmationId: null,
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

function draftFromRow(row: EmployeeTransaction): RowDraft {
  return {
    id: row.id,
    isNew: false,
    isSystem: row.is_system_generated,
    existingScreenshotId: row.transaction_screenshot_id,
    existingConfirmationId: row.confirmation_screenshot_id,
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

function signedImpact(amount: number, effect: EffectDirection | null | undefined) {
  if (effect == null) return 0
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

function computeDraftUsd(draft: RowDraft): number {
  if (draft.amount_currency === 'INR') {
    const inr = parseNumber(draft.amount_inr)
    const rate = parseNumber(draft.exchange_rate)
    if (inr > 0 && rate > 0) return round2(inr / rate)
    return 0
  }
  return round2(parseNumber(draft.amount_usd))
}

function normalizeDraft(yearMonth: string, draft: RowDraft, showError: (msg: string) => void) {
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

  return {
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

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [newRowIds, setNewRowIds] = useState<string[]>([])
  const [drawerRowId, setDrawerRowId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const periodMonthFilter = `${yearMonth}-01`

  const loadData = useCallback(async () => {
    if (!activeBusinessId) return

    let txQ = supabase
      .from('employee_transactions')
      .select(
        'id,business_id,employee_id,project_id,transaction_name,txn_date,period_month,entry_kind,amount,amount_currency,amount_inr,exchange_rate,amount_usd,from_account_id,to_account_id,payment_method,transaction_screenshot_id,confirmation_screenshot_id,settlement_group_id,parent_transaction_id,layer_order,expected_commission_percent,actual_commission_percent,expected_commission_amount_usd,actual_commission_amount_usd,description,notes,is_system_generated,created_at,updated_at',
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

    setDrafts((prev) => {
      const next: Record<string, RowDraft> = {}
      for (const row of txRows) next[row.id] = draftFromRow(row)
      for (const tempId of newRowIds) if (prev[tempId]) next[tempId] = prev[tempId]
      return next
    })

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
  }, [activeBusinessId, periodMonthFilter, filterEmployeeId, showError, newRowIds])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, periodMonthFilter, filterEmployeeId])

  const accountMap = useMemo(() => {
    const map: Record<string, RecipientAccount> = {}
    for (const a of accounts) map[a.id] = a
    return map
  }, [accounts])

  const effectsByKind = useMemo(() => {
    const map: Record<string, { employee_balance_effect: EffectDirection | null; employer_profitability_effect: EffectDirection | null }> = {}
    for (const opt of getOptions('employee_transaction_kind')) {
      map[opt.code] = {
        employee_balance_effect: (opt.employee_balance_effect ?? null) as EffectDirection | null,
        employer_profitability_effect: (opt.employer_profitability_effect ?? null) as EffectDirection | null,
      }
    }
    return map
  }, [getOptions])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount_usd ?? row.amount ?? 0)
        const effects = effectsByKind[row.entry_kind]
        acc.employeeBalance += signedImpact(amount, effects?.employee_balance_effect)
        acc.employerProfitability += signedImpact(amount, effects?.employer_profitability_effect)
        return acc
      },
      { employeeBalance: 0, employerProfitability: 0 },
    )
  }, [rows, effectsByKind])

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

  function patchDraft(id: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => {
      const current = prev[id]
      if (!current) return prev
      return { ...prev, [id]: { ...current, ...patch } }
    })
  }

  function updateSupportingFile(id: string, index: number, field: keyof FileDraft, value: string) {
    setDrafts((prev) => {
      const current = prev[id]
      if (!current) return prev
      const next = [...current.supportingFiles]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, [id]: { ...current, supportingFiles: next } }
    })
  }

  function addSupportingFile(id: string) {
    setDrafts((prev) => {
      const current = prev[id]
      if (!current) return prev
      return { ...prev, [id]: { ...current, supportingFiles: [...current.supportingFiles, emptyFileDraft()] } }
    })
  }

  function removeSupportingFile(id: string, index: number) {
    setDrafts((prev) => {
      const current = prev[id]
      if (!current) return prev
      return { ...prev, [id]: { ...current, supportingFiles: current.supportingFiles.filter((_, i) => i !== index) } }
    })
  }

  function addNewRow() {
    clearNotice()
    const draft = emptyDraft(yearMonth)
    setDrafts((prev) => ({ ...prev, [draft.id]: draft }))
    setNewRowIds((prev) => [draft.id, ...prev])
  }

  function cancelNewRow(id: string) {
    setNewRowIds((prev) => prev.filter((x) => x !== id))
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (drawerRowId === id) setDrawerRowId(null)
  }

  function resetSavedRow(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    setDrafts((prev) => ({ ...prev, [id]: draftFromRow(row) }))
  }

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

    if (error) throw new Error(error.message)
    return data.id
  }

  async function saveRow(id: string) {
    if (!activeBusinessId) return
    const draft = drafts[id]
    if (!draft) return
    if (draft.isSystem) return

    clearNotice()
    setSavingId(id)

    const normalized = normalizeDraft(yearMonth, draft, showError)
    if (!normalized) {
      setSavingId(null)
      return
    }

    let screenshotId: string | null = draft.existingScreenshotId
    let confirmationId: string | null = draft.existingConfirmationId

    try {
      const maybeShot = await createFileRecord(draft.transactionScreenshot)
      if (maybeShot) screenshotId = maybeShot
      const maybeConfirm = await createFileRecord(draft.confirmationScreenshot)
      if (maybeConfirm) confirmationId = maybeConfirm
    } catch (error) {
      showError((error as Error).message)
      setSavingId(null)
      return
    }

    const basePayload = {
      business_id: activeBusinessId,
      employee_id: draft.employee_id,
      project_id: null,
      transaction_name: draft.transaction_name.trim(),
      txn_date: normalized.txnDate,
      period_month: normalized.periodMonth,
      entry_kind: draft.entry_kind,
      amount: normalized.amountUsd,
      amount_currency: draft.amount_currency,
      amount_inr: normalized.amountInr,
      exchange_rate: normalized.exchangeRate,
      amount_usd: normalized.amountUsd,
      from_account_id: draft.from_account_id || null,
      to_account_id: draft.to_account_id || null,
      payment_method: draft.payment_method.trim() || null,
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
    }

    let transactionId: string | null = draft.isNew ? null : draft.id
    const newFreshScreenshotAdded = !!draft.transactionScreenshot.file_url.trim()
    const newFreshConfirmationAdded = !!draft.confirmationScreenshot.file_url.trim()

    if (draft.isNew) {
      const { data, error } = await supabase
        .from('employee_transactions')
        .insert({ ...basePayload, is_system_generated: false })
        .select('id')
        .single()

      if (error) {
        showError(error.message)
        setSavingId(null)
        return
      }
      transactionId = data.id
    } else {
      const { error } = await supabase
        .from('employee_transactions')
        .update({ ...basePayload, updated_at: new Date().toISOString() })
        .eq('id', draft.id)
        .eq('is_system_generated', false)

      if (error) {
        showError(error.message)
        setSavingId(null)
        return
      }
    }

    if (!transactionId) {
      showError('Unable to save transaction.')
      setSavingId(null)
      return
    }

    if (newFreshScreenshotAdded || newFreshConfirmationAdded) {
      await supabase
        .from('employee_transaction_file_links')
        .delete()
        .eq('transaction_id', transactionId)
        .in('file_role', ['TRANSACTION_SCREENSHOT', 'CONFIRMATION_SCREENSHOT'])

      const fixedLinks: { transaction_id: string; file_id: string; file_role: 'TRANSACTION_SCREENSHOT' | 'CONFIRMATION_SCREENSHOT' }[] = []
      if (screenshotId && newFreshScreenshotAdded) fixedLinks.push({ transaction_id: transactionId, file_id: screenshotId, file_role: 'TRANSACTION_SCREENSHOT' })
      if (confirmationId && newFreshConfirmationAdded) fixedLinks.push({ transaction_id: transactionId, file_id: confirmationId, file_role: 'CONFIRMATION_SCREENSHOT' })
      if (fixedLinks.length) {
        const { error } = await supabase.from('employee_transaction_file_links').insert(fixedLinks)
        if (error) {
          showError(error.message)
          setSavingId(null)
          return
        }
      }
    }

    const extraLinks: { transaction_id: string; file_id: string; file_role: 'SUPPORTING_DOCUMENT' }[] = []
    for (const file of draft.supportingFiles) {
      if (!file.file_url.trim()) continue
      try {
        const fileId = await createFileRecord(file)
        if (fileId) extraLinks.push({ transaction_id: transactionId, file_id: fileId, file_role: 'SUPPORTING_DOCUMENT' })
      } catch (error) {
        showError((error as Error).message)
        setSavingId(null)
        return
      }
    }

    if (extraLinks.length) {
      const { error } = await supabase.from('employee_transaction_file_links').insert(extraLinks)
      if (error) {
        showError(error.message)
        setSavingId(null)
        return
      }
    }

    if (draft.isNew) {
      setNewRowIds((prev) => prev.filter((x) => x !== draft.id))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      if (drawerRowId === draft.id) setDrawerRowId(null)
    }

    setSavingId(null)
    await loadData()
    showSuccess(draft.isNew ? 'Transaction added.' : 'Transaction updated.')
  }

  async function deleteRow(id: string) {
    const draft = drafts[id]
    if (!draft) return
    if (draft.isNew) {
      cancelNewRow(id)
      return
    }
    if (draft.isSystem) return
    if (!confirmAction('Delete this transaction?')) return

    const { error } = await supabase
      .from('employee_transactions')
      .delete()
      .eq('id', id)
      .eq('is_system_generated', false)

    if (error) {
      showError(error.message)
      return
    }

    if (drawerRowId === id) setDrawerRowId(null)
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

  const orderedIds = useMemo(() => {
    return [...newRowIds, ...rows.map((r) => r.id)]
  }, [newRowIds, rows])

  const drawerDraft = drawerRowId ? drafts[drawerRowId] ?? null : null

  if (!activeBusinessId) {
    return <p className="text-muted">Select a business first.</p>
  }

  return (
    <>
      <PageSection
        title="Employee Transactions"
        actions={
          <div className="flex-row gap-xs">
            <button type="button" className="btn-primary btn-sm" onClick={addNewRow}>
              + New row
            </button>
          </div>
        }
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Inline-editable grid. Core fields edit in place; click <strong>Details</strong> for commission, notes, and file
          proofs. Supports multi-layer routing and INR to USD conversion.
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

        <NoticeBanner message={message} type={type} />

        <div className="tableWrap">
          <table style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>Date</th>
                <th style={{ minWidth: 160 }}>Name</th>
                <th style={{ minWidth: 170 }}>Type</th>
                <th style={{ minWidth: 150 }}>Employee</th>
                <th style={{ minWidth: 140 }}>From</th>
                <th style={{ minWidth: 140 }}>To</th>
                <th style={{ minWidth: 130 }}>Method</th>
                <th style={{ minWidth: 70 }}>Cur</th>
                <th style={{ minWidth: 100 }}>INR</th>
                <th style={{ minWidth: 80 }}>FX</th>
                <th style={{ minWidth: 110 }}>USD</th>
                <th style={{ minWidth: 90 }}>Proof</th>
                <th style={{ minWidth: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedIds.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                    No transactions for this period{filterEmployeeId ? ' and employee' : ''}.
                  </td>
                </tr>
              )}
              {orderedIds.map((id) => {
                const draft = drafts[id]
                if (!draft) return null
                const editable = !draft.isSystem
                const savedRow = !draft.isNew ? rows.find((r) => r.id === id) : null
                const computedUsd = computeDraftUsd(draft)
                const attachmentCount = !draft.isNew ? attachmentCounts[id] ?? 0 : 0
                const txnShotFile = savedRow?.transaction_screenshot_id ? fileMap[savedRow.transaction_screenshot_id] : null
                const confirmFile = savedRow?.confirmation_screenshot_id ? fileMap[savedRow.confirmation_screenshot_id] : null

                return (
                  <tr key={id} style={draft.isNew ? { background: 'var(--color-accent-light)' } : undefined}>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <input
                          type="date"
                          value={draft.txn_date}
                          onChange={(e) => patchDraft(id, { txn_date: e.target.value })}
                          style={cellInp}
                        />
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>{draft.txn_date}</span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <input
                          value={draft.transaction_name}
                          onChange={(e) => patchDraft(id, { transaction_name: e.target.value })}
                          placeholder="Transaction name"
                          style={{ ...cellInp, fontWeight: 600 }}
                        />
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block', fontWeight: 600 }}>{draft.transaction_name}</span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <select
                          value={draft.entry_kind}
                          onChange={(e) => patchDraft(id, { entry_kind: e.target.value as TransactionKind })}
                          style={cellInp}
                        >
                          {EDITABLE_KINDS.map((kind) => (
                            <option key={kind} value={kind}>{kindLabel(kind, getOptions)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge badge-neutral" style={{ marginLeft: '0.45rem' }}>
                          {kindLabel(draft.entry_kind, getOptions)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <select
                          value={draft.employee_id}
                          onChange={(e) => patchDraft(id, { employee_id: e.target.value })}
                          style={cellInp}
                        >
                          <option value="">Select</option>
                          {employees.map((em) => <option key={em.id} value={em.id}>{em.full_name}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>{empName(draft.employee_id)}</span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <select
                          value={draft.from_account_id}
                          onChange={(e) => patchDraft(id, { from_account_id: e.target.value })}
                          style={cellInp}
                        >
                          <option value="">—</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>{accountName(draft.from_account_id || null)}</span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <select
                          value={draft.to_account_id}
                          onChange={(e) => patchDraft(id, { to_account_id: e.target.value })}
                          style={cellInp}
                        >
                          <option value="">—</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>{accountName(draft.to_account_id || null)}</span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <select
                          value={draft.payment_method}
                          onChange={(e) => patchDraft(id, { payment_method: e.target.value })}
                          style={cellInp}
                        >
                          <option value="">—</option>
                          {paymentMethodOptions.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>{draft.payment_method || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: 0 }}>
                      {editable ? (
                        <select
                          value={draft.amount_currency}
                          onChange={(e) => patchDraft(id, { amount_currency: e.target.value as 'USD' | 'INR' })}
                          style={cellInp}
                        >
                          <option value="USD">USD</option>
                          <option value="INR">INR</option>
                        </select>
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>{draft.amount_currency}</span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'right' }}>
                      {editable && draft.amount_currency === 'INR' ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.amount_inr}
                          onChange={(e) => patchDraft(id, { amount_inr: e.target.value })}
                          style={{ ...cellInp, textAlign: 'right' }}
                        />
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>
                          {draft.amount_currency === 'INR' && draft.amount_inr
                            ? Number(draft.amount_inr).toLocaleString('en-US')
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'right' }}>
                      {editable && draft.amount_currency === 'INR' ? (
                        <input
                          type="number"
                          min="0"
                          step="0.000001"
                          value={draft.exchange_rate}
                          onChange={(e) => patchDraft(id, { exchange_rate: e.target.value })}
                          style={{ ...cellInp, textAlign: 'right' }}
                        />
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>
                          {draft.amount_currency === 'INR' && draft.exchange_rate
                            ? Number(draft.exchange_rate).toFixed(4)
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'right', fontWeight: 600 }}>
                      {editable && draft.amount_currency === 'USD' ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.amount_usd}
                          onChange={(e) => patchDraft(id, { amount_usd: e.target.value })}
                          style={{ ...cellInp, textAlign: 'right', fontWeight: 600 }}
                        />
                      ) : (
                        <span style={{ padding: '0.4rem 0.45rem', display: 'inline-block' }}>
                          {money(draft.amount_currency === 'INR' ? computedUsd : Number(draft.amount_usd || 0))}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.72rem' }}>
                      {draft.isNew ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <>
                          T: {txnShotFile ? <a href={txnShotFile.file_url} target="_blank" rel="noreferrer">view</a> : '—'}
                          <br />
                          C: {confirmFile ? <a href={confirmFile.file_url} target="_blank" rel="noreferrer">view</a> : '—'}
                          <br />
                          Docs: {attachmentCount}
                        </>
                      )}
                    </td>
                    <td>
                      {editable ? (
                        <div className="flex-row gap-xs" style={{ display: 'inline-flex' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => setDrawerRowId(drawerRowId === id ? null : id)}
                          >
                            {drawerRowId === id ? 'Close' : 'Details'}
                          </button>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            onClick={() => saveRow(id)}
                            disabled={savingId === id}
                          >
                            {savingId === id ? 'Saving…' : draft.isNew ? 'Add' : 'Save'}
                          </button>
                          {draft.isNew ? (
                            <button type="button" className="btn-secondary btn-sm" onClick={() => cancelNewRow(id)}>
                              Cancel
                            </button>
                          ) : (
                            <>
                              <button type="button" className="btn-secondary btn-sm" onClick={() => resetSavedRow(id)}>
                                Reset
                              </button>
                              <button type="button" className="btn-danger btn-sm" onClick={() => deleteRow(id)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>{sourceLabelByKind(draft.entry_kind)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
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
                  <td>{s.throughAccounts ? s.throughAccounts.split(',').map((aid) => accountName(aid)).join(', ') : '—'}</td>
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

      {drawerDraft && (
        <div
          role="dialog"
          aria-label="Transaction details"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(520px, 96vw)',
            background: 'var(--color-surface)',
            borderLeft: '1px solid var(--color-border)',
            boxShadow: '-4px 0 18px rgba(0,0,0,0.12)',
            zIndex: 50,
            overflowY: 'auto',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {drawerDraft.isNew ? 'New transaction details' : 'Transaction details'}
            </h3>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setDrawerRowId(null)}>Close</button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            Edit routing, commissions, notes, and proof file links. Changes here are saved when you click <strong>Save</strong> on the row.
          </p>

          <div className="form-grid">
            <FormField label="Settlement group ID">
              <input
                value={drawerDraft.settlement_group_id}
                onChange={(e) => patchDraft(drawerDraft.id, { settlement_group_id: e.target.value })}
                placeholder="Optional UUID to group related legs"
              />
            </FormField>

            <FormField label="Parent transaction leg">
              <select
                value={drawerDraft.parent_transaction_id}
                onChange={(e) => patchDraft(drawerDraft.id, { parent_transaction_id: e.target.value })}
              >
                <option value="">None</option>
                {rows.filter((r) => r.id !== drawerDraft.id).map((r) => (
                  <option key={r.id} value={r.id}>{r.transaction_name} ({r.txn_date})</option>
                ))}
              </select>
            </FormField>

            <FormField label="Layer order">
              <input
                type="number"
                min="1"
                step="1"
                value={drawerDraft.layer_order}
                onChange={(e) => patchDraft(drawerDraft.id, { layer_order: e.target.value })}
              />
            </FormField>

            <FormField label="Expected commission %">
              <input
                type="number"
                min="0"
                step="0.0001"
                value={drawerDraft.expected_commission_percent}
                onChange={(e) => patchDraft(drawerDraft.id, { expected_commission_percent: e.target.value })}
              />
            </FormField>

            <FormField label="Actual commission %">
              <input
                type="number"
                min="0"
                step="0.0001"
                value={drawerDraft.actual_commission_percent}
                onChange={(e) => patchDraft(drawerDraft.id, { actual_commission_percent: e.target.value })}
              />
            </FormField>

            <FormField label="Expected commission USD">
              <input
                type="number"
                min="0"
                step="0.01"
                value={drawerDraft.expected_commission_amount_usd}
                onChange={(e) => patchDraft(drawerDraft.id, { expected_commission_amount_usd: e.target.value })}
              />
            </FormField>

            <FormField label="Actual commission USD">
              <input
                type="number"
                min="0"
                step="0.01"
                value={drawerDraft.actual_commission_amount_usd}
                onChange={(e) => patchDraft(drawerDraft.id, { actual_commission_amount_usd: e.target.value })}
              />
            </FormField>

            <FormField label="Description">
              <input
                value={drawerDraft.description}
                onChange={(e) => patchDraft(drawerDraft.id, { description: e.target.value })}
              />
            </FormField>

            <FormField label="Notes">
              <input
                value={drawerDraft.notes}
                onChange={(e) => patchDraft(drawerDraft.id, { notes: e.target.value })}
              />
            </FormField>

            <FormField label="Transaction screenshot name">
              <input
                value={drawerDraft.transactionScreenshot.file_name}
                onChange={(e) => patchDraft(drawerDraft.id, { transactionScreenshot: { ...drawerDraft.transactionScreenshot, file_name: e.target.value } })}
              />
            </FormField>

            <FormField label="Transaction screenshot URL">
              <input
                value={drawerDraft.transactionScreenshot.file_url}
                onChange={(e) => patchDraft(drawerDraft.id, { transactionScreenshot: { ...drawerDraft.transactionScreenshot, file_url: e.target.value } })}
                placeholder="https://..."
              />
            </FormField>

            <FormField label="Confirmation screenshot name">
              <input
                value={drawerDraft.confirmationScreenshot.file_name}
                onChange={(e) => patchDraft(drawerDraft.id, { confirmationScreenshot: { ...drawerDraft.confirmationScreenshot, file_name: e.target.value } })}
              />
            </FormField>

            <FormField label="Confirmation screenshot URL">
              <input
                value={drawerDraft.confirmationScreenshot.file_url}
                onChange={(e) => patchDraft(drawerDraft.id, { confirmationScreenshot: { ...drawerDraft.confirmationScreenshot, file_url: e.target.value } })}
                placeholder="https://..."
              />
            </FormField>

            <div className="field" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start' }}>
              <button type="button" className="btn-secondary btn-sm" onClick={() => addSupportingFile(drawerDraft.id)}>
                + Add supporting proof
              </button>
            </div>

            {drawerDraft.supportingFiles.map((f, i) => (
              <div key={`sup-${i}`} style={{ gridColumn: '1 / -1', padding: '0.5rem', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div className="form-grid">
                  <FormField label={`Support file ${i + 1} name`}>
                    <input value={f.file_name} onChange={(e) => updateSupportingFile(drawerDraft.id, i, 'file_name', e.target.value)} />
                  </FormField>
                  <FormField label={`Support file ${i + 1} URL`}>
                    <input value={f.file_url} onChange={(e) => updateSupportingFile(drawerDraft.id, i, 'file_url', e.target.value)} placeholder="https://..." />
                  </FormField>
                  <FormField label="MIME (optional)">
                    <input value={f.mime_type} onChange={(e) => updateSupportingFile(drawerDraft.id, i, 'mime_type', e.target.value)} placeholder="image/png, application/pdf" />
                  </FormField>
                  <div className="field" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-danger btn-sm" onClick={() => removeSupportingFile(drawerDraft.id, i)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
