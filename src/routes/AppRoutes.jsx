import { Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import RoleBasedLayout from '../components/layout/RoleBasedLayout';
import ProtectedRoute from './ProtectedRoute';

import HomePage from '../pages/public/HomePage';
import SearchPage from '../pages/public/SearchPage';
import LawyerProfilePage from '../pages/public/LawyerProfilePage';
import FirmProfilePage from '../pages/public/FirmProfilePage';
import AboutPage from '../pages/public/AboutPage';
import NotFoundPage from '../pages/public/NotFoundPage';
import NotificationsPage from '../pages/public/NotificationsPage';
import CalendarPage from '../pages/public/CalendarPage';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';

import BookConsultationPage from '../pages/client/BookConsultationPage';
import CheckoutPage from '../pages/client/CheckoutPage';
import PaymentResultPage from '../pages/client/PaymentResultPage';
import ClientDashboard from '../pages/client/ClientDashboard';
import ClientConsultations from '../pages/client/ClientConsultations';
import ClientConsultationDetail from '../pages/client/ClientConsultationDetail';
import ClientPayments from '../pages/client/ClientPayments';
import ClientRefunds from '../pages/client/ClientRefunds';
import ClientSaved from '../pages/client/ClientSaved';
import ClientSettings from '../pages/client/ClientSettings';

import LawyerDashboard from '../pages/lawyer/LawyerDashboard';
import LawyerEditProfile from '../pages/lawyer/LawyerEditProfile';
import LawyerAvailability from '../pages/lawyer/LawyerAvailability';
import LawyerConsultationSettings from '../pages/lawyer/LawyerConsultationSettings';
import LawyerConsultationRequests from '../pages/lawyer/LawyerConsultationRequests';
import LawyerAppointments from '../pages/lawyer/LawyerAppointments';
import LawyerAppointmentDetail from '../pages/lawyer/LawyerAppointmentDetail';
import LawyerFirmMembership from '../pages/lawyer/LawyerFirmMembership';
import LawyerSettings from '../pages/lawyer/LawyerSettings';
import AdvocateMessagesPage from '../pages/lawyer/AdvocateMessagesPage';
import AdminAdvocateVerificationsPage from '../pages/admin/AdminAdvocateVerificationsPage';

import FirmDashboard from '../pages/firm/FirmDashboard';
import FirmEditProfile from '../pages/firm/FirmEditProfile';
import FirmMembers from '../pages/firm/FirmMembers';
import FirmRequests from '../pages/firm/FirmRequests';
import FirmConsultations from '../pages/firm/FirmConsultations';
import FirmSettings from '../pages/firm/FirmSettings';

export default function AppRoutes() {
  return (
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
  );
}
