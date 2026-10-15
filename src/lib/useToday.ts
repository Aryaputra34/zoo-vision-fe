"use client";

import { useEffect, useState } from 'react';
import { todayLocal } from './time';

// Today in the site time zone, moving to the next day within a minute of midnight: pages without ?date are
// often left open on a wall display.
export function useToday(): string {
  const [today, setToday] = useState(() => todayLocal());
  useEffect(() => {
    const timer = setInterval(() => setToday(todayLocal()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
