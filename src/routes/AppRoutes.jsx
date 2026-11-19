import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import RoleBasedLayout from '../components/layout/RoleBasedLayout';
import ProtectedRoute from './ProtectedRoute';

const HomePage = lazy(() => import('../pages/public/HomePage'));
const SearchPage = lazy(() => import('../pages/public/SearchPage'));
const LawyerProfilePage = lazy(() => import('../pages/public/LawyerProfilePage'));
const FirmProfilePage = lazy(() => import('../pages/public/FirmProfilePage'));
const AboutPage = lazy(() => import('../pages/public/AboutPage'));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage'));
const NotificationsPage = lazy(() => import('../pages/public/NotificationsPage'));
const CalendarPage = lazy(() => import('../pages/public/CalendarPage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const SignupPage = lazy(() => import('../pages/auth/SignupPage'));

const BookConsultationPage = lazy(() => import('../pages/client/BookConsultationPage'));
const CheckoutPage = lazy(() => import('../pages/client/CheckoutPage'));
const PaymentResultPage = lazy(() => import('../pages/client/PaymentResultPage'));
const ClientDashboard = lazy(() => import('../pages/client/ClientDashboard'));
const ClientConsultations = lazy(() => import('../pages/client/ClientConsultations'));
const ClientConsultationDetail = lazy(() => import('../pages/client/ClientConsultationDetail'));
const ClientPayments = lazy(() => import('../pages/client/ClientPayments'));
const ClientRefunds = lazy(() => import('../pages/client/ClientRefunds'));
const ClientSaved = lazy(() => import('../pages/client/ClientSaved'));
const ClientSettings = lazy(() => import('../pages/client/ClientSettings'));

const LawyerDashboard = lazy(() => import('../pages/lawyer/LawyerDashboard'));
const LawyerEditProfile = lazy(() => import('../pages/lawyer/LawyerEditProfile'));
const LawyerAvailability = lazy(() => import('../pages/lawyer/LawyerAvailability'));
const LawyerConsultationSettings = lazy(() => import('../pages/lawyer/LawyerConsultationSettings'));
const LawyerConsultationRequests = lazy(() => import('../pages/lawyer/LawyerConsultationRequests'));
const LawyerAppointments = lazy(() => import('../pages/lawyer/LawyerAppointments'));
const LawyerAppointmentDetail = lazy(() => import('../pages/lawyer/LawyerAppointmentDetail'));
const LawyerFirmMembership = lazy(() => import('../pages/lawyer/LawyerFirmMembership'));
const LawyerSettings = lazy(() => import('../pages/lawyer/LawyerSettings'));
const AdvocateMessagesPage = lazy(() => import('../pages/lawyer/AdvocateMessagesPage'));
const AdminAdvocateVerificationsPage = lazy(() => import('../pages/admin/AdminAdvocateVerificationsPage'));

const FirmDashboard = lazy(() => import('../pages/firm/FirmDashboard'));
const FirmEditProfile = lazy(() => import('../pages/firm/FirmEditProfile'));
const FirmMembers = lazy(() => import('../pages/firm/FirmMembers'));
const FirmRequests = lazy(() => import('../pages/firm/FirmRequests'));
const FirmConsultations = lazy(() => import('../pages/firm/FirmConsultations'));
const FirmSettings = lazy(() => import('../pages/firm/FirmSettings'));

function RouteLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading page">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-navy" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="lawyers/:id" element={<LawyerProfilePage />} />
        <Route path="lawyers/:id/book" element={<BookConsultationPage />} />
        <Route path="checkout/:bookingId" element={<CheckoutPage />} />
        <Route path="payment-result/:bookingId" element={<PaymentResultPage />} />
        <Route path="firms/:id" element={<FirmProfilePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin/advocate-verifications" element={<AdminAdvocateVerificationsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={['client', 'lawyer', 'firm']} />}>
        <Route element={<RoleBasedLayout />}>
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['client']} />}>
        <Route path="client" element={<RoleBasedLayout />}>
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="consultations" element={<ClientConsultations />} />
          <Route path="consultations/:bookingId" element={<ClientConsultationDetail />} />
          <Route path="payments" element={<ClientPayments />} />
          <Route path="refunds" element={<ClientRefunds />} />
          <Route path="saved" element={<ClientSaved />} />
          <Route path="settings" element={<ClientSettings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['lawyer']} />}>
        <Route path="lawyer" element={<RoleBasedLayout />}>
          <Route path="dashboard" element={<LawyerDashboard />} />
          <Route path="edit-profile" element={<LawyerEditProfile />} />
          <Route path="availability" element={<LawyerAvailability />} />
          <Route path="consultation-settings" element={<LawyerConsultationSettings />} />
          <Route path="consultation-requests" element={<LawyerConsultationRequests />} />
          <Route path="appointments" element={<LawyerAppointments />} />
          <Route path="appointments/:bookingId" element={<LawyerAppointmentDetail />} />
          <Route path="firm-membership" element={<LawyerFirmMembership />} />
          <Route path="settings" element={<LawyerSettings />} />
          <Route path="messages" element={<AdvocateMessagesPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['firm']} />}>
        <Route path="firm" element={<RoleBasedLayout />}>
          <Route path="dashboard" element={<FirmDashboard />} />
          <Route path="edit-profile" element={<FirmEditProfile />} />
          <Route path="members" element={<FirmMembers />} />
          <Route path="requests" element={<FirmRequests />} />
          <Route path="consultations" element={<FirmConsultations />} />
          <Route path="settings" element={<FirmSettings />} />
        </Route>
      </Route>
      </Routes>
    </Suspense>
  );
}
