'use client';

import { useEffect, useRef, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import Splash from '@/components/Splash';

const EXIT_MS = 300;

export default function Page() {
  // Default: show splash. Share-link arrivals (#config=…) skip it.
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const enteredRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash.startsWith('#config=')) {
      enteredRef.current = true;
      setEntered(true);
    }
  }, []);

  function handleEnter() {
    if (exiting || enteredRef.current) return;
    enteredRef.current = true;
    setExiting(true);
    window.setTimeout(() => {
      setEntered(true);
      setExiting(false);
    }, EXIT_MS);
  }

  if (entered) return <Dashboard />;
  return <Splash onEnter={handleEnter} exiting={exiting} />;
}
