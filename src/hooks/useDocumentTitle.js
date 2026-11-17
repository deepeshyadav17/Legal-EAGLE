import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Legal Eagle` : 'Legal Eagle — Find the Right Legal Professional';
  }, [title]);
}
