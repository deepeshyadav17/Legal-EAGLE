import { apiClient, setAccessToken } from './apiClient';

/**
 * Go Backend API Adapter (`/api/v1`).
 * Connects the React frontend to the Go + Gin + PostgreSQL backend without
 * requiring changes to React page components.
 */

export const goBackendAdapter = {
  // Authentication
  async register(role, payload) {
    const { data } = await apiClient.post('/auth/register', { role, ...payload });
    setAccessToken(data.accessToken);
    return data.user;
  },
  async login(email, password) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    return data.user;
  },
  async demoLogin(role) {
    const { data } = await apiClient.post('/auth/demo-login', { role });
    setAccessToken(data.accessToken);
    return data.user;
  },
  async refresh() {
    const { data } = await apiClient.post('/auth/refresh');
    setAccessToken(data.accessToken);
    return data.user;
  },
  async logout() {
    await apiClient.post('/auth/logout');
    setAccessToken(null);
  },
  async getMe() {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  // Discovery & Profiles
  async searchLawyers(params) {
    const { data } = await apiClient.get('/lawyers', { params });
    return data;
  },
  async getLawyer(id) {
    const { data } = await apiClient.get(`/lawyers/${id}`);
    return data;
  },
  async getLawyerContact(id) {
    const { data } = await apiClient.get(`/lawyers/${id}/contact`);
    return data;
  },
  async updateLawyerMe(patch) {
    const { data } = await apiClient.patch('/lawyers/me', patch);
    return data;
  },
  async searchFirms(params) {
    const { data } = await apiClient.get('/firms', { params });
    return data;
  },
  async getFirm(id) {
    const { data } = await apiClient.get(`/firms/${id}`);
    return data;
  },

  // Availability
  async getLawyerAvailability(id, date) {
    const { data } = await apiClient.get(`/lawyers/${id}/availability`, { params: date ? { date } : {} });
    return data;
  },
  async updateAvailabilityRules(patch) {
    const { data } = await apiClient.put('/lawyers/me/availability/rules', patch);
    return data;
  },
  async mutateAvailabilityException(payload) {
    const { data } = await apiClient.post('/lawyers/me/availability/exceptions', payload);
    return data;
  },

  // Consultation Bookings (Module A)
  async createBookingHold({ lawyerId, slotId, mode, clientNotes, idempotencyKey }) {
    const { data } = await apiClient.post(
      '/booking-holds',
      {
        lawyerId,
        slotId,
        consultationMode: mode,
        clientNotes,
        idempotencyKey,
      },
      {
        headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
      },
    );
    return data;
  },
  async getBooking(id) {
    const { data } = await apiClient.get(`/bookings/${id}`);
    return data;
  },
  async getMyBookings() {
    const { data } = await apiClient.get('/bookings/me');
    return data;
  },
  async acceptBooking(id) {
    const { data } = await apiClient.post(`/bookings/${id}/accept`);
    return data;
  },
  async declineBooking(id, reason) {
    const { data } = await apiClient.post(`/bookings/${id}/decline`, { reason });
    return data;
  },
  async proposeReschedule(id, { proposedSlotId, reason }) {
    const { data } = await apiClient.post(`/bookings/${id}/reschedule-proposals`, {
      proposedSlotId,
      reason,
    });
    return data;
  },
  async acceptRescheduleProposal(bookingId, proposalId = 'latest') {
    const { data } = await apiClient.post(
      `/bookings/${bookingId}/reschedule-proposals/${proposalId}/accept`,
    );
    return data;
  },
  async rejectRescheduleProposal(bookingId, proposalId = 'latest') {
    const { data } = await apiClient.post(
      `/bookings/${bookingId}/reschedule-proposals/${proposalId}/reject`,
    );
    return data;
  },

  // Payments & Refunds (Module B)
  async createPaymentOrder(bookingId) {
    const { data } = await apiClient.post('/payments/orders', { bookingId });
    return data;
  },
  async getPayment(id) {
    const { data } = await apiClient.get(`/payments/${id}`);
    return data;
  },
  async getMyPayments() {
    const { data } = await apiClient.get('/payments/me');
    return data;
  },
  async getRefund(id) {
    const { data } = await apiClient.get(`/refunds/${id}`);
    return data;
  },
  async getMyRefunds() {
    const { data } = await apiClient.get('/refunds/me');
    return data;
  },
  async simulateWebhook(payload) {
    const { data } = await apiClient.post('/webhooks/razorpay', payload, {
      headers: { 'X-Razorpay-Signature': 'mock_valid_signature' },
    });
    return data;
  },

  // Notifications (Module C)
  async getNotifications() {
    const { data } = await apiClient.get('/notifications');
    return data;
  },
  async markNotificationRead(id) {
    const { data } = await apiClient.patch(`/notifications/${id}/read`);
    return data;
  },
  async markAllNotificationsRead() {
    const { data } = await apiClient.patch('/notifications/read-all');
    return data;
  },
};

