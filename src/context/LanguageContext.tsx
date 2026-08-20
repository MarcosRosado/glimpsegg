import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'pt-BR',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en-US' || saved === 'pt-BR') return saved;
    return 'pt-BR'; // Default to PT-BR as requested by user
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    if (window.api && typeof window.api.store?.set === 'function') {
      window.api.store.set('language', lang).catch(console.warn);
    }
  };

  useEffect(() => {
    // Check if electron store has language setting
    if (window.api && typeof window.api.store?.get === 'function') {
      window.api.store.get('language').then((storedLang) => {
        if (storedLang === 'en-US' || storedLang === 'pt-BR') {
          setLanguageState(storedLang);
        }
      }).catch(console.warn);
    }
  }, []);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations['pt-BR'];
    let text: string = dict[key] || translations['en-US'][key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}
