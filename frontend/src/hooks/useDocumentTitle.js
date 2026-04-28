import { useEffect } from 'react';

export default function useDocumentTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | WellTrack` : 'WellTrack';
    return () => { document.title = prev; };
  }, [title]);
}
