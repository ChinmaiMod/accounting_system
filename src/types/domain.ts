export type Business = {
  id: string
  owner_user_id: string
  name: string
  legal_name: string | null
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  default_business_id: string | null
}

export type Employee = {
  id: string
  business_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string | null
  employee_type: 'W2' | 'C2C'
  overtime_pay_rate: number
  holiday_pay_rate: number
  holiday_ot_pay_rate: number
  travel_reimbursement_rate: number
  employer_tax_percent: number
}

export type EmployeeContact = {
  id: string
  employee_id: string
  contact_type: 'WHATSAPP' | 'CALLING' | 'HOME' | 'WORK' | 'OTHER'
  phone: string
  label: string | null
}

export type Timesheet = {
  id: string
  business_id: string
  employee_id: string
  project_id: string
  work_date: string
  work_type: 'REGULAR' | 'OVERTIME' | 'HOLIDAY' | 'HOLIDAY_OT'
  hours: number
  travel_hours: number
}

export type Invoice = {
  id: string
  business_id: string
  vendor_id: string
  invoice_number: string
  invoice_date: string
  period_start: string
  period_end: string
  payment_terms: 'NET_7' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'NET_90'
  due_date: string
  total_amount: number
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
}

export type EndClient = {
  id: string
  business_id: string
  name: string
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export type Vendor = {
  id: string
  business_id: string
  name: string
  invoice_frequency: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'
  payment_terms: 'NET_7' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'NET_90'
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export type VendorContact = {
  id: string
  vendor_id: string
  contact_type: 'INVOICING' | 'ACCOUNTS_PAYABLE' | 'RECRUITER' | 'CEO'
  contact_name: string | null
  email: string | null
  phone: string | null
}

export type Project = {
  id: string
  business_id: string
  end_client_id: string
  vendor_id: string | null
  employee_id: string | null
  name: string
  start_date: string | null
  end_date: string | null
  work_mode: 'REMOTE' | 'HYBRID' | 'ONSITE'
  work_location_address1: string | null
  work_location_address2: string | null
  work_location_city: string | null
  work_location_state: string | null
  work_location_zip: string | null
  end_client_actual_bill_rate: number
  end_client_informed_bill_rate: number
  employee_agreed_percent: number
  employee_project_rate: number
  tenure_discount_percent: number
  volume_discount_percent: number
  vms_discount_percent: number
  early_payment_discount_percent: number
  lca_hourly_rate: number | null
  timesheet_frequency: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'
}

export type DailyProfitability = {
  business_id: string
  work_date: string
  revenue_amount: number
  direct_cost_amount: number
  employer_tax_amount: number
  gross_profit_amount: number
}

export type TimesheetProfitabilityRow = {
  timesheet_id: string
  business_id: string
  employee_id: string
  project_id: string
  work_date: string
  work_type: 'REGULAR' | 'OVERTIME' | 'HOLIDAY' | 'HOLIDAY_OT'
  hours: number
  employee_type: 'W2' | 'C2C'
  revenue_amount: number
  direct_cost_amount: number
  employer_tax_amount: number
}

export type InvoiceProject = {
  id: string
  invoice_id: string
  project_id: string
  employee_id: string | null
  hours: number
  bill_rate: number
  amount: number
}

export type RecipientAccount = {
  id: string
  business_id: string
  employee_id: string | null
  account_name: string
  account_type: 'EMPLOYER' | 'EMPLOYEE' | 'INTERMEDIARY' | 'CANDIDATE' | 'VENDOR' | 'OTHER'
  payment_identifier: string | null
  bank_name: string | null
  country: string | null
  currency: 'USD' | 'INR'
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TransactionFile = {
  id: string
  business_id: string
  file_name: string
  file_url: string
  mime_type: string | null
  uploaded_at: string
}

export type EmployeeTransaction = {
  id: string
  business_id: string
  employee_id: string
  project_id: string | null
  transaction_name: string
  txn_date: string
  period_month: string
  entry_kind:
    | 'EMPLOYEE_EARNINGS'
    | 'EXPENSE_DEDUCTION'
    | 'EXPENSE_REIMBURSEMENT'
    | 'MANUAL_CREDIT'
    | 'MANUAL_DEBIT'
    | 'PAYMENT_TO_EMPLOYEE'
    | 'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT'
    | 'EMPLOYEE_PAYROLL_CHECK'
    | 'PAYROLL_AMENDMENT_FEES'
    | 'EMPLOYER_TAX_FULL_PAYROLL'
    | 'EMPLOYER_TAX_LCA_DEFICIENCY'
    | 'CANDIDATE_PAYMENT_INDIA'
    | 'CANDIDATE_REPAYMENT_INDIA'
    | 'HEALTH_INSURANCE_DEDUCTION'
    | 'H1B_AMENDMENT_FILING_FEES'
    | 'H1B_AMENDMENT_ATTORNEY_FEES'
    | 'H1B_AMENDMENT_EXTENSION_FILING_FEES'
    | 'H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES'
    | 'H4_FILING_FEES'
    | 'H4_ATTORNEY_FEES'
    | 'H4_EAD_FILING_FEES'
    | 'H4_EAD_ATTORNEY_FEES'
  amount: number
  amount_currency: 'USD' | 'INR'
  amount_inr: number | null
  exchange_rate: number | null
  amount_usd: number
  from_account_id: string | null
  to_account_id: string | null
  payment_method: string | null
  transaction_screenshot_id: string | null
  confirmation_screenshot_id: string | null
  settlement_group_id: string | null
  parent_transaction_id: string | null
  layer_order: number
  expected_commission_percent: number | null
  actual_commission_percent: number | null
  expected_commission_amount_usd: number | null
  actual_commission_amount_usd: number | null
  description: string
  notes: string | null
  is_system_generated: boolean
  employee_balance_effect: 'ADD' | 'SUBTRACT'
  employer_profitability_effect: 'ADD' | 'SUBTRACT'
  created_at: string
  updated_at: string
}

export type LookupValue = {
  id: string
  business_id: string
  category: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
}
