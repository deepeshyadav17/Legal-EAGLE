import { getDb, commit, delay, uid, ServiceError } from './mockDb';
import { DEMO_MODE } from './apiClient';
import { goBackendAdapter } from './backendAdapter';
import { requireRole } from './authService';

function ensureCommunityData(db) {
  db.advocateVerifications = db.advocateVerifications || [];
  db.directConversations = db.directConversations || [];
  db.directMessages = db.directMessages || [];
}

function requireApprovedAdvocate(profileId) {
  const db = getDb();
  ensureCommunityData(db);
  const verification = db.advocateVerifications.find(
    (item) => item.profileId === profileId && item.status === 'APPROVED',
  );
  if (!verification || !lawyerUserForProfile(db, profileId)) {
    throw new ServiceError('Only active, manually approved advocates can use private messaging.', 403);
  }
  return db;
}

function lawyerUserForProfile(db, profileId) {
  return db.users.find((user) => user.role === 'lawyer' && user.profileId === profileId);
}

function conversationForProfiles(db, profileId, otherProfileId) {
  return db.directConversations.find(
    (conversation) =>
      (conversation.participantA === profileId && conversation.participantB === otherProfileId) ||
      (conversation.participantA === otherProfileId && conversation.participantB === profileId),
  );
}

function conversationSummary(db, conversation, currentProfileId) {
  const otherProfileId = conversation.participantA === currentProfileId
    ? conversation.participantB
    : conversation.participantA;
  const lawyer = db.lawyers.find((item) => item.id === otherProfileId);
  const messages = db.directMessages.filter((message) => message.conversationId === conversation.id);
  const latest = messages[messages.length - 1];
  return {
    id: conversation.id,
    advocate: {
      profileId: otherProfileId,
      name: lawyer?.name || 'Advocate',
      city: lawyer?.city || '',
      photo: lawyer?.photo || '',
    },
    lastMessage: latest?.body || '',
    updatedAt: latest?.createdAt || conversation.updatedAt,
  };
}

export async function getMyAdvocateVerification() {
  const user = requireRole('lawyer');
  if (!DEMO_MODE) return goBackendAdapter.getMyAdvocateVerification();
  await delay(100);
  const db = getDb();
  ensureCommunityData(db);
  return db.advocateVerifications.find((item) => item.profileId === user.profileId) || { status: 'NOT_SUBMITTED' };
}

export async function submitAdvocateVerification({ barCouncil, enrollmentNumber }) {
  const user = requireRole('lawyer');
  const cleanCouncil = String(barCouncil || '').trim();
  const cleanEnrollment = String(enrollmentNumber || '').trim().toUpperCase();
  if (cleanCouncil.length < 2 || cleanCouncil.length > 120 || cleanEnrollment.length < 2 || cleanEnrollment.length > 80) {
    throw new ServiceError('Enter a valid Bar Council and enrollment number.');
  }
  if (!DEMO_MODE) {
    return goBackendAdapter.submitAdvocateVerification({
      barCouncil: cleanCouncil,
      enrollmentNumber: cleanEnrollment,
    });
  }

  await delay(200);
  const db = getDb();
  ensureCommunityData(db);
  if (db.advocateVerifications.some(
    (item) =>
      item.profileId !== user.profileId &&
      item.barCouncil.toLowerCase() === cleanCouncil.toLowerCase() &&
      item.enrollmentNumber.toUpperCase() === cleanEnrollment,
  )) {
    throw new ServiceError('That Bar Council enrollment is already associated with another account.', 409);
  }
  const existing = db.advocateVerifications.find((item) => item.profileId === user.profileId);
  if (existing && existing.status !== 'REJECTED') {
    throw new ServiceError('A verification request is already pending or approved.', 409);
  }
  const request = {
    profileId: user.profileId,
    barCouncil: cleanCouncil,
    enrollmentNumber: cleanEnrollment,
    status: 'PENDING',
    submittedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, request);
  else db.advocateVerifications.push(request);
  commit();
  return request;
}

export async function listPendingAdvocateVerifications() {
  const user = requireRole('admin');
  if (!DEMO_MODE) return goBackendAdapter.listPendingAdvocateVerifications();
  await delay(150);
  const db = getDb();
  ensureCommunityData(db);
  return db.advocateVerifications
    .filter((item) => item.status === 'PENDING')
    .map((item) => ({
      ...item,
      advocateName: db.lawyers.find((lawyer) => lawyer.id === item.profileId)?.name || 'Advocate',
      reviewedBy: user.id,
    }));
}

export async function reviewAdvocateVerification(profileId, status) {
  const user = requireRole('admin');
  if (!['APPROVED', 'REJECTED'].includes(status)) throw new ServiceError('Choose approve or reject.');
  if (!DEMO_MODE) return goBackendAdapter.reviewAdvocateVerification(profileId, status);
  await delay(120);
  const db = getDb();
  ensureCommunityData(db);
  const request = db.advocateVerifications.find(
    (item) => item.profileId === profileId && item.status === 'PENDING',
  );
  if (!request) throw new ServiceError('Pending verification request not found.', 404);
  request.status = status;
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = user.id;
  commit();
  return request;
}

export async function listVerifiedAdvocates(q = '') {
  const user = requireRole('lawyer');
  if (!DEMO_MODE) return goBackendAdapter.listVerifiedAdvocates({ q });
  await delay(150);
  const db = requireApprovedAdvocate(user.profileId);
  const term = q.trim().toLowerCase();
  return db.advocateVerifications
    .filter((item) => item.status === 'APPROVED' && item.profileId !== user.profileId)
    .map((item) => {
      const lawyer = db.lawyers.find((profile) => profile.id === item.profileId);
      const account = lawyerUserForProfile(db, item.profileId);
      return lawyer && account ? {
        profileId: lawyer.id,
        name: lawyer.name,
        city: lawyer.city,
        photo: lawyer.photo || '',
      } : null;
    })
    .filter((item) => item && (!term || item.name.toLowerCase().includes(term) || item.city.toLowerCase().includes(term)));
}

export async function listCommunityConversations() {
  const user = requireRole('lawyer');
  if (!DEMO_MODE) return goBackendAdapter.listCommunityConversations();
  await delay(100);
  const db = requireApprovedAdvocate(user.profileId);
  return db.directConversations
    .filter((item) => item.participantA === user.profileId || item.participantB === user.profileId)
    .filter((item) => {
      const peerId = item.participantA === user.profileId ? item.participantB : item.participantA;
      return db.advocateVerifications.some((verification) => verification.profileId === peerId && verification.status === 'APPROVED')
        && !!lawyerUserForProfile(db, peerId);
    })
    .map((item) => conversationSummary(db, item, user.profileId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function startCommunityConversation(recipientProfileId) {
  const user = requireRole('lawyer');
  if (!DEMO_MODE) return goBackendAdapter.startCommunityConversation(recipientProfileId);
  await delay(120);
  const db = requireApprovedAdvocate(user.profileId);
  requireApprovedAdvocate(recipientProfileId);
  if (recipientProfileId === user.profileId || !lawyerUserForProfile(db, recipientProfileId)) {
    throw new ServiceError('Choose another approved advocate.', 400);
  }
  let conversation = conversationForProfiles(db, user.profileId, recipientProfileId);
  if (!conversation) {
    conversation = {
      id: uid('conversation'),
      participantA: [user.profileId, recipientProfileId].sort()[0],
      participantB: [user.profileId, recipientProfileId].sort()[1],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.directConversations.push(conversation);
    commit();
  }
  return conversationSummary(db, conversation, user.profileId);
}

function requireConversationParticipant(db, conversationId, profileId) {
  const conversation = db.directConversations.find((item) => item.id === conversationId);
  if (!conversation || (conversation.participantA !== profileId && conversation.participantB !== profileId)) {
    throw new ServiceError('Conversation not found.', 404);
  }
  const otherProfileId = conversation.participantA === profileId ? conversation.participantB : conversation.participantA;
  requireApprovedAdvocate(otherProfileId);
  return conversation;
}

export async function listCommunityMessages(conversationId) {
  const user = requireRole('lawyer');
  if (!DEMO_MODE) return goBackendAdapter.listCommunityMessages(conversationId);
  await delay(80);
  const db = requireApprovedAdvocate(user.profileId);
  requireConversationParticipant(db, conversationId, user.profileId);
  return db.directMessages
    .filter((item) => item.conversationId === conversationId)
    .slice(-100);
}

export async function sendCommunityMessage(conversationId, rawBody) {
  const user = requireRole('lawyer');
  const body = String(rawBody || '').trim();
  if (!body || [...body].length > 4000) throw new ServiceError('Messages must contain 1 to 4,000 characters.');
  if (!DEMO_MODE) return goBackendAdapter.sendCommunityMessage(conversationId, body);
  await delay(100);
  const db = requireApprovedAdvocate(user.profileId);
  const conversation = requireConversationParticipant(db, conversationId, user.profileId);
  const message = {
    id: uid('message'),
    conversationId,
    senderProfileId: user.profileId,
    body,
    createdAt: new Date().toISOString(),
  };
  db.directMessages.push(message);
  conversation.updatedAt = message.createdAt;
  commit();
  return message;
}
