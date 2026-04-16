import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './features/auth/AuthGate'
import { DashboardHomePage } from './features/dashboard/DashboardHomePage'
import { OwnerShell } from './features/owner/OwnerShell'
import { BusinessesPage } from './features/businesses/BusinessesPage'
import { EmployeesPage } from './features/employees/EmployeesPage'
import { TimesheetsPage } from './features/timesheets/TimesheetsPage'
import { InvoicesPage } from './features/invoices/InvoicesPage'
import { PaymentsPage } from './features/payments/PaymentsPage'
import { EndClientsPage } from './features/clients/EndClientsPage'
import { VendorsPage } from './features/vendors/VendorsPage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { EmployeeTransactionsPage } from './features/employees/EmployeeTransactionsPage'
import { RecipientAccountsPage } from './features/employees/RecipientAccountsPage'
import { EmployeeDashboardPage } from './features/employees/EmployeeDashboardPage'
import { ProfitabilityReportPage } from './features/reports/ProfitabilityReportPage'
import { DataAdminPage } from './features/admin/DataAdminPage'

function App() {
  return (
    <AuthGate>
      {(session) => (
        <Routes>
          <Route path="/" element={<OwnerShell session={session} />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="businesses" element={<BusinessesPage />} />
            <Route path="end-clients" element={<EndClientsPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="expenses" element={<Navigate to="/employee-transactions" replace />} />
            <Route path="timesheets" element={<TimesheetsPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoice-payments" element={<PaymentsPage />} />
            <Route path="payments" element={<Navigate to="/invoice-payments" replace />} />
            <Route path="recipient-accounts" element={<RecipientAccountsPage />} />
            <Route path="employee-transactions" element={<EmployeeTransactionsPage />} />
            <Route path="employee-dashboard" element={<EmployeeDashboardPage />} />
            <Route path="reports" element={<ProfitabilityReportPage />} />
            <Route path="data-admin" element={<DataAdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AuthGate>
  )
}

export default App
