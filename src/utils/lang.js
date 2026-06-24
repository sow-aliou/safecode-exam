import { useState, useEffect } from 'react';
import { translations } from './translations';

export function getLanguage() {
  return localStorage.getItem('safecode_lang') || 'fr';
}

export function setLanguage(lang) {
  localStorage.setItem('safecode_lang', lang);
  window.dispatchEvent(new Event('languageChange'));
}

export function useTranslation() {
  const [lang, setLangState] = useState(getLanguage());

  useEffect(() => {
    const handleLangChange = () => {
      setLangState(getLanguage());
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const t = (key) => {
    if (!translations[lang]) return key;
    return translations[lang][key] || key;
  };

  return { t, lang, setLanguage };
}
