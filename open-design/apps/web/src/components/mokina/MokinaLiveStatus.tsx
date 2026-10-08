import { useEffect, useRef, useState } from 'react';

/** A short live summary; details remain readable outside the live region. */
export function MokinaLiveStatus({ identity, summary, label = summary }: {
  identity: string; summary: string; label?: string;
}) {
  const previous = useRef({ identity, summary: '' });
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (previous.current.identity !== identity) {
      previous.current = { identity, summary };
      setAnnouncement('');
      return;
    }
    if (previous.current.summary === summary) return;
    previous.current = { identity, summary };
    setAnnouncement(label);
  }, [identity, summary, label]);
  return <span className="mokina-live-summary" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>;
}
