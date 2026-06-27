import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type Language,
  type Translations,
  DICTIONARIES,
  translate,
} from "@/constants/i18n";

const LANG_KEY = "wahatna_lang";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: keyof Translations) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((saved) => {
        if (saved && saved in DICTIONARIES) {
          setLang(saved as Language);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLang(lang);
    try {
      await AsyncStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, []);

  const t = useCallback(
    (key: keyof Translations) => translate(language, key),
    [language],
  );

  const isRTL = DICTIONARIES[language].isRTL;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used inside LanguageProvider");
  return ctx;
}
