'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getBrowserTimezone } from './timezone';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  // Initialize with detected timezone immediately to avoid empty string
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return getBrowserTimezone();
    } catch (error) {
      console.warn('Failed to detect timezone on initialization:', error);
      return 'UTC';
    }
  });

  useEffect(() => {
    // Re-detect browser timezone on mount (in case it changed)
    const detectedTimezone = getBrowserTimezone();
    setTimezone(detectedTimezone);
  }, []);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
