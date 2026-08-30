import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en-US',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en-US' || saved === 'pt-BR') return saved;
    // Padrao en-US, alinhado ao README: o publico que chega pelo repositorio nao é so
    // brasileiro. Vale SO quando nao ha preferencia guardada — quem ja escolheu, em
    // qualquer das duas fontes, mantem a escolha (o `saved` acima e o efeito do store
    // do Electron abaixo tem precedencia sobre este default).
    return 'en-US';
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
    const dict = translations[language] || translations['en-US'];
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
