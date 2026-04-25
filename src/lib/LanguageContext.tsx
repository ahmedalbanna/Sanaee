import { createContext, useContext, useState, ReactNode } from 'react';

type Lang = 'ar' | 'en';

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
}

const translations: Record<string, { ar: string; en: string }> = {
  appName: { ar: 'صنايعي', en: 'Sanaey' },
  loading: { ar: 'جاري التحميل...', en: 'Loading...' },
  login: { ar: 'تسجيل الدخول', en: 'Login' },
  logout: { ar: 'تسجيل الخروج', en: 'Logout' },
  customerBtn: { ar: 'أنا عميل (أحتاج خدمة)', en: 'Find a Craftsman' },
  workerBtn: { ar: 'أنا حرفي (مقدم خدمة)', en: 'Provide a Service' },
  langToggle: { ar: 'English', en: 'عربي' },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ar',
  toggleLang: () => {},
  t: (k) => k
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>('ar');

  const toggleLang = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const t = (key: string) => {
    return translations[key]?.[lang] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className={lang === 'ar' ? 'font-sans' : 'font-sans'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
