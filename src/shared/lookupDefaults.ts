export type LookupOption = { code: string; label: string }

export const LOOKUP_CATEGORIES: {
  page: string
  categories: { key: string; label: string }[]
}[] = [
  {
    page: 'Employees',
    categories: [
      { key: 'employee_type', label: 'Employee Type' },
      { key: 'employee_contact_type', label: 'Employee Contact Type' },
    ],
  },
  {
    page: 'Vendors',
    categories: [
      { key: 'vendor_invoice_frequency', label: 'Invoice Frequency' },
      { key: 'vendor_payment_terms', label: 'Payment Terms' },
      { key: 'vendor_contact_type', label: 'Vendor Contact Type' },
    ],
  },
  {
    page: 'Projects',
    categories: [
      { key: 'project_work_mode', label: 'Work Mode' },
      { key: 'project_timesheet_frequency', label: 'Timesheet Frequency' },
    ],
  },
  {
    page: 'Invoices',
    categories: [
      { key: 'invoice_status', label: 'Invoice Status' },
      { key: 'invoice_payment_terms', label: 'Invoice Payment Terms' },
    ],
  },
  {
    page: 'Timesheets',
    categories: [
      { key: 'timesheet_work_type', label: 'Work Type' },
    ],
  },
  {
    page: 'Employee Transactions',
    categories: [
      { key: 'employee_transaction_kind', label: 'Transaction kind (labels)' },
      { key: 'transaction_payment_method', label: 'Payment Method' },
      { key: 'recipient_account_type', label: 'Recipient Account Type' },
    ],
  },
]

export const LOOKUP_DEFAULTS: Record<string, LookupOption[]> = {
  employee_type: [
    { code: 'W2', label: 'W2' },
    { code: 'C2C', label: 'C2C' },
  ],
  employee_contact_type: [
    { code: 'WHATSAPP', label: 'WhatsApp' },
    { code: 'CALLING', label: 'Calling' },
    { code: 'HOME', label: 'Home' },
    { code: 'WORK', label: 'Work' },
    { code: 'OTHER', label: 'Other' },
  ],
  vendor_invoice_frequency: [
    { code: 'WEEKLY', label: 'Weekly' },
    { code: 'BI_WEEKLY', label: 'Bi-Weekly' },
    { code: 'MONTHLY', label: 'Monthly' },
  ],
  vendor_payment_terms: [
    { code: 'NET_7', label: 'Net 7' },
    { code: 'NET_15', label: 'Net 15' },
    { code: 'NET_30', label: 'Net 30' },
    { code: 'NET_45', label: 'Net 45' },
    { code: 'NET_60', label: 'Net 60' },
    { code: 'NET_90', label: 'Net 90' },
  ],
  vendor_contact_type: [
    { code: 'INVOICING', label: 'Invoicing' },
    { code: 'ACCOUNTS_PAYABLE', label: 'Accounts Payable' },
    { code: 'RECRUITER', label: 'Recruiter' },
    { code: 'CEO', label: 'CEO' },
  ],
  project_work_mode: [
    { code: 'REMOTE', label: 'Remote' },
    { code: 'HYBRID', label: 'Hybrid' },
    { code: 'ONSITE', label: 'Onsite' },
  ],
  project_timesheet_frequency: [
    { code: 'WEEKLY', label: 'Weekly' },
    { code: 'BI_WEEKLY', label: 'Bi-Weekly' },
    { code: 'MONTHLY', label: 'Monthly' },
  ],
  invoice_status: [
    { code: 'DRAFT', label: 'Draft' },
    { code: 'SENT', label: 'Sent' },
    { code: 'PARTIALLY_PAID', label: 'Partially Paid' },
    { code: 'PAID', label: 'Paid' },
    { code: 'OVERDUE', label: 'Overdue' },
  ],
  invoice_payment_terms: [
    { code: 'NET_7', label: 'Net 7' },
    { code: 'NET_15', label: 'Net 15' },
    { code: 'NET_30', label: 'Net 30' },
    { code: 'NET_45', label: 'Net 45' },
    { code: 'NET_60', label: 'Net 60' },
    { code: 'NET_90', label: 'Net 90' },
  ],
  timesheet_work_type: [
    { code: 'REGULAR', label: 'Regular' },
    { code: 'OVERTIME', label: 'Overtime' },
    { code: 'HOLIDAY', label: 'Holiday' },
    { code: 'HOLIDAY_OT', label: 'Holiday OT' },
  ],
  employee_transaction_kind: [
    { code: 'EMPLOYEE_EARNINGS', label: 'Employee earnings' },
    { code: 'EXPENSE_DEDUCTION', label: 'Expense deduction' },
    { code: 'EXPENSE_REIMBURSEMENT', label: 'Expense reimbursement' },
    { code: 'MANUAL_CREDIT', label: 'Manual credit' },
    { code: 'MANUAL_DEBIT', label: 'Manual debit' },
    { code: 'PAYMENT_TO_EMPLOYEE', label: 'Payment to employee' },
    { code: 'EMPLOYEE_PAYROLL_DIRECT_DEPOSIT', label: 'Employee Payroll with Direct Deposit' },
    { code: 'EMPLOYEE_PAYROLL_CHECK', label: 'Employee Payroll with Check' },
    { code: 'PAYROLL_AMENDMENT_FEES', label: 'Payroll Amendment Fees' },
    { code: 'EMPLOYER_TAX_FULL_PAYROLL', label: 'Employer Taxes for full payroll' },
    { code: 'EMPLOYER_TAX_LCA_DEFICIENCY', label: 'Employer Taxes for LCA deficiency' },
    { code: 'CANDIDATE_PAYMENT_INDIA', label: 'Payment to Candidate in India' },
    { code: 'CANDIDATE_REPAYMENT_INDIA', label: 'Payment made by candidate in India' },
    { code: 'HEALTH_INSURANCE_DEDUCTION', label: 'Health Insurance Deduction' },
    { code: 'H1B_AMENDMENT_FILING_FEES', label: 'H1B Amendment Filing Fees' },
    { code: 'H1B_AMENDMENT_ATTORNEY_FEES', label: 'H1B Amendment Attorney Fees' },
    { code: 'H1B_AMENDMENT_EXTENSION_FILING_FEES', label: 'H1B Amendment + Extension Filing Fees' },
    { code: 'H1B_AMENDMENT_EXTENSION_ATTORNEY_FEES', label: 'H1B Amendment + Extension Attorney Fees' },
    { code: 'H4_FILING_FEES', label: 'H4 Filing Fees' },
    { code: 'H4_ATTORNEY_FEES', label: 'H4 Attorney Fees' },
    { code: 'H4_EAD_FILING_FEES', label: 'H4 EAD Filing Fees' },
    { code: 'H4_EAD_ATTORNEY_FEES', label: 'H4 EAD Attorney Fees' },
  ],
  transaction_payment_method: [
    { code: 'ZELLE', label: 'Zelle' },
    { code: 'US_BANK_TO_US_BANK', label: 'US Bank to US Bank' },
    { code: 'US_BANK_TO_INDIA_BANK', label: 'US Bank to India Bank' },
    { code: 'INDIA_BANK_TO_INDIA_BANK', label: 'India Bank to India Bank' },
    { code: 'ACH', label: 'ACH' },
    { code: 'WIRE', label: 'Wire Transfer' },
    { code: 'CHECK', label: 'Check' },
    { code: 'CASH', label: 'Cash' },
  ],
  recipient_account_type: [
    { code: 'EMPLOYER', label: 'Employer' },
    { code: 'EMPLOYEE', label: 'Employee' },
    { code: 'INTERMEDIARY', label: 'Intermediary' },
    { code: 'CANDIDATE', label: 'Candidate' },
    { code: 'VENDOR', label: 'Vendor' },
    { code: 'OTHER', label: 'Other' },
  ],
}
