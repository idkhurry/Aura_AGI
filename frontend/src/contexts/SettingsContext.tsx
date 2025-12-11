/**
 * Settings Context - Global configuration state
 * 
 * Manages user preferences and system settings with localStorage persistence.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuraSettings {
  // User Identity
  commanderIdentity: string;
  
  // Context Window
  contextWindowSize: number; // 5-100
  
  // L2 Reasoning
  enableL2Analysis: boolean;
  
  // Theme (future)
  theme: 'dark' | 'light';
}

interface SettingsContextType {
  settings: AuraSettings;
  updateSettings: (updates: Partial<AuraSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AuraSettings = {
  commanderIdentity: 'Mai',
  contextWindowSize: 20,
  enableL2Analysis: true,
  theme: 'dark',
};

const SETTINGS_KEY = 'aura_settings';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AuraSettings>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...defaultSettings, ...parsed };
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
    return defaultSettings;
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        // Also set legacy key for backward compatibility
        localStorage.setItem('aura_user_name', settings.commanderIdentity);
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }
  }, [settings]);

  const updateSettings = (updates: Partial<AuraSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETTINGS_KEY);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
