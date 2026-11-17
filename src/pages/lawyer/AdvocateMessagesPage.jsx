import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Loader2, MessageCircle, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import FormField from '../../components/forms/FormField';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  getMyAdvocateVerification,
  listCommunityConversations,
  listCommunityMessages,
  listVerifiedAdvocates,
  sendCommunityMessage,
  startCommunityConversation,
  submitAdvocateVerification,
} from '../../services/communityService';

function formatMessageTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function AdvocateMessagesPage() {
  useDocumentTitle('Advocate Messages');
  const { user } = useAuth();
  const { notify } = useToast();
  const [verification, setVerification] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [barCouncil, setBarCouncil] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [advocates, setAdvocates] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selectedConversation = conversations.find((item) => item.id === selectedId);

  const visibleAdvocates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return advocates.filter((advocate) =>
      !term || advocate.name.toLowerCase().includes(term) || advocate.city.toLowerCase().includes(term),
    );
  }, [advocates, search]);

  const refreshVerification = async () => {
    setVerificationLoading(true);
    setError('');
    try {
      const result = await getMyAdvocateVerification();
      setVerification(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerificationLoading(false);
    }
  };

  useEffect(() => {
    refreshVerification();
    // Load verification status once per signed-in advocate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.profileId]);

  useEffect(() => {
    if (verification?.status !== 'APPROVED') return undefined;
    let active = true;
    setLoadingInbox(true);
    Promise.all([listVerifiedAdvocates(), listCommunityConversations()])
      .then(([nextAdvocates, nextConversations]) => {
        if (!active) return;
        setAdvocates(nextAdvocates);
        setConversations(nextConversations);
        setSelectedId((current) => current || nextConversations[0]?.id || '');
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingInbox(false);
      });
    return () => {
      active = false;
    };
  }, [verification?.status]);

  useEffect(() => {
    if (!selectedId || verification?.status !== 'APPROVED') {
      setMessages([]);
      return undefined;
    }
    let active = true;
    const refreshMessages = async () => {
      try {
        const result = await listCommunityMessages(selectedId);
        if (active) {
          setMessages(result);
          setError('');
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    };
    refreshMessages();
    const timer = window.setInterval(refreshMessages, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId, verification?.status]);

  const handleVerificationSubmit = async (event) => {
    event.preventDefault();
    setSubmittingVerification(true);
    setError('');
    try {
      const result = await submitAdvocateVerification({ barCouncil, enrollmentNumber });
      setVerification(result);
      notify('Verification request submitted for manual review.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleStartConversation = async (advocate) => {
    setError('');
    try {
      const result = await startCommunityConversation(advocate.profileId);
      const conversation = { ...result, advocate };
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== result.id)]);
      setSelectedId(result.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending || !selectedId) return;
    setSending(true);
    try {
      const sent = await sendCommunityMessage(selectedId, draft);
      setMessages((current) => [...current.filter((item) => item.id !== sent.id), sent].slice(-100));
      setDraft('');
      setConversations((current) => current.map((item) =>
        item.id === selectedId ? { ...item, lastMessage: sent.body, updatedAt: sent.createdAt } : item,
      ));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advocate community"
        title="Private messages"
        description="Connect one-to-one with advocates whose Bar Council details have been reviewed by a platform admin."
      />

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {verificationLoading ? (
        <div className="card flex items-center gap-3 p-6 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking advocate verification…
        </div>
      ) : verification?.status !== 'APPROVED' ? (
        <section className="card max-w-2xl p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-100 text-navy">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-navy">
                {verification?.status === 'PENDING' ? 'Verification under review' : 'Verify your advocate account'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {verification?.status === 'PENDING'
                  ? 'An administrator will review your Bar Council and enrollment details. Messaging unlocks after approval.'
                  : verification?.status === 'REJECTED'
                    ? 'Your previous request was not approved. Check your details and submit them again for review.'
                    : 'Submit your Bar Council and enrollment details. A platform administrator will review them before you can message other advocates.'}
              </p>
            </div>
          </div>

          {verification?.status !== 'PENDING' && (
            <form onSubmit={handleVerificationSubmit} className="mt-6 space-y-4">
              <FormField
                label="State Bar Council"
                required
                placeholder="e.g. Bar Council of Delhi"
                value={barCouncil}
                onChange={(event) => setBarCouncil(event.target.value)}
                maxLength={120}
              />
              <FormField
                label="Enrollment number"
                required
                placeholder="Enter your advocate enrollment number"
                value={enrollmentNumber}
                onChange={(event) => setEnrollmentNumber(event.target.value)}
                maxLength={80}
              />
              <p className="rounded-xl bg-cream p-3 text-xs leading-relaxed text-muted">
                Do not enter passwords or upload documents here. An administrator must independently review these details before approval.
              </p>
              <button type="submit" disabled={submittingVerification} className="btn btn-primary">
                {submittingVerification && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Submit for review
              </button>
            </form>
          )}

          {verification?.status === 'PENDING' && (
            <div className="mt-5 rounded-xl bg-cream p-4 text-sm">
              <p><span className="font-medium">Bar Council:</span> {verification.barCouncil}</p>
              <p className="mt-1"><span className="font-medium">Enrollment:</span> {verification.enrollmentNumber}</p>
              <button type="button" onClick={refreshVerification} className="btn btn-outline btn-sm mt-4">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh status
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="grid min-h-[36rem] overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="border-b border-line lg:border-b-0 lg:border-r">
            <div className="border-b border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-navy">Advocates</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-medium text-green-800">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                </span>
              </div>
              <label className="relative mt-3 block">
                <span className="sr-only">Search verified advocates</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or city"
                  className="input pl-9"
                />
              </label>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 lg:max-h-[25rem]">
              {loadingInbox ? (
                <p className="p-4 text-sm text-muted">Loading advocates…</p>
              ) : visibleAdvocates.length ? visibleAdvocates.map((advocate) => (
                <div key={advocate.profileId} className="flex items-center gap-3 rounded-xl p-3 hover:bg-cream">
                  <Avatar name={advocate.name} src={advocate.photo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">{advocate.name}</p>
                    <p className="truncate text-xs text-muted">{advocate.city}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartConversation(advocate)}
                    className="btn btn-outline btn-sm"
                  >
                    Message
                  </button>
                </div>
              )) : (
                <p className="p-4 text-sm text-muted">No other approved advocates found yet.</p>
              )}
            </div>
            <div className="border-t border-line p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Recent conversations
              </h3>
              {conversations.length ? conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${selectedId === conversation.id ? 'bg-navy text-white' : 'hover:bg-cream'}`}
                >
                  <Avatar name={conversation.advocate.name} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{conversation.advocate.name}</span>
                    <span className={`block truncate text-xs ${selectedId === conversation.id ? 'text-white/70' : 'text-muted'}`}>
                      {conversation.lastMessage || 'Start a conversation'}
                    </span>
                  </span>
                </button>
              )) : <p className="text-xs text-muted">Your conversations will appear here.</p>}
            </div>
          </aside>

          <div className="flex min-h-[30rem] flex-col">
            {selectedConversation ? (
              <>
                <header className="flex items-center gap-3 border-b border-line px-5 py-4">
                  <Avatar name={selectedConversation.advocate.name} src={selectedConversation.advocate.photo} size="sm" />
                  <div>
                    <p className="font-semibold text-navy">{selectedConversation.advocate.name}</p>
                    <p className="text-xs text-muted">{selectedConversation.advocate.city} · Approved advocate</p>
                  </div>
                </header>
                <div className="flex-1 space-y-3 overflow-y-auto bg-cream/40 p-4 sm:p-6" aria-live="polite">
                  {messages.length ? messages.map((message) => {
                    const ownMessage = message.senderProfileId === user.profileId;
                    return (
                      <div key={message.id} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${ownMessage ? 'bg-navy text-white' : 'border border-line bg-white text-ink'}`}>
                          <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                          <p className={`mt-1 text-right text-[10px] ${ownMessage ? 'text-white/65' : 'text-muted'}`}>{formatMessageTime(message.createdAt)}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="grid h-full min-h-48 place-items-center text-center text-sm text-muted">
                      No messages yet. Send a note to start the conversation.
                    </div>
                  )}
                </div>
                <form onSubmit={handleSend} className="flex items-end gap-3 border-t border-line p-4">
                  <label className="flex-1">
                    <span className="sr-only">Message</span>
                    <textarea
                      rows={2}
                      maxLength={4000}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Write a private message…"
                      className="input resize-y"
                    />
                    <span className="mt-1 block text-right text-[11px] text-muted">{draft.length}/4000</span>
                  </label>
                  <button type="submit" disabled={!draft.trim() || sending} className="btn btn-primary mb-5">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <MessageCircle className="mx-auto h-10 w-10 text-gold-600" aria-hidden="true" />
                  <h2 className="mt-3 font-semibold text-navy">Your private inbox</h2>
                  <p className="mt-1 max-w-sm text-sm text-muted">Choose an approved advocate to start a one-to-one conversation.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
