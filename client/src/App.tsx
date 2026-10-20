import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import JobsPage from './pages/Jobs';
import JobFormPage from './pages/JobForm';
import JobDetailPage from './pages/JobDetail';
import ApplicationsPage from './pages/Applications';
import ApplicationDetailPage from './pages/ApplicationDetail';
import CalendarPage from './pages/Calendar';
import PaymentsPage from './pages/Payments';
import DocumentsPage from './pages/Documents';
import MembersPage from './pages/Members';
import NotificationsPage from './pages/Notifications';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Loading label="Starting…" />;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        {isAdmin && <Route path="jobs/new" element={<JobFormPage />} />}
        {isAdmin && <Route path="jobs/:id/edit" element={<JobFormPage />} />}
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/:id" element={<ApplicationDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        {isAdmin && <Route path="members" element={<MembersPage />} />}
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
