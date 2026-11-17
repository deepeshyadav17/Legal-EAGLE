import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import * as clientService from '../services/clientService';

/** Bookmark state for client accounts, shared by cards and dashboards. */
const SavedContext = createContext(null);
const EMPTY = { lawyers: [], firms: [] };

export function SavedProvider({ children }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [saved, setSaved] = useState(EMPTY);
  const isClient = user?.role === 'client';

  useEffect(() => {
    if (!isClient) {
      setSaved(EMPTY);
      return;
    }
    clientService.getClient(user.profileId).then((c) => setSaved(c.saved)).catch(() => setSaved(EMPTY));
  }, [isClient, user?.profileId]);

  const isSaved = useCallback((type, id) => saved[type === 'lawyer' ? 'lawyers' : 'firms'].includes(id), [saved]);

  const toggle = useCallback(
    async (type, id, name = 'Profile') => {
      if (!isClient) return false;
      try {
        const res = await clientService.toggleSaved(user.profileId, type, id);
        setSaved(res.savedIds);
        notify(res.saved ? `${name} saved to your list.` : `${name} removed from saved.`, res.saved ? 'success' : 'info');
        return res.saved;
      } catch (e) {
        notify(e.message, 'error');
        return null;
      }
    },
    [isClient, user?.profileId, notify],
  );

  const value = useMemo(() => ({ saved, isSaved, toggle, canSave: isClient }), [saved, isSaved, toggle, isClient]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSaved = () => useContext(SavedContext);
