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
    page: 'Employee Expenses',
    categories: [
      { key: 'expense_deduction_mode', label: 'Deduction Mode' },
      { key: 'expense_borne_by', label: 'Expense Bearer' },
      { key: 'expense_status', label: 'Expense Status' },
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
  expense_deduction_mode: [
    { code: 'PAYROLL_DEDUCTION', label: 'Payroll Deduction' },
    { code: 'WAGE_DEDUCTION', label: 'Wage Deduction' },
    { code: 'REIMBURSEMENT', label: 'Reimbursement' },
  ],
  expense_borne_by: [
    { code: 'COMPANY', label: 'Company' },
    { code: 'EMPLOYEE', label: 'Employee' },
  ],
  expense_status: [
    { code: 'PENDING', label: 'Pending' },
    { code: 'APPLIED', label: 'Applied' },
    { code: 'WAIVED', label: 'Waived' },
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
}
