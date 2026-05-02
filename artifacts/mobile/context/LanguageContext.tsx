import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type LangCode = "en" | "ar" | "fr" | "de" | "es";

export const LANGUAGES: Record<LangCode, { label: string; flag: string; rtl: boolean }> = {
  en: { label: "English", flag: "🇺🇸", rtl: false },
  ar: { label: "العربية", flag: "🇦🇪", rtl: true },
  fr: { label: "Français", flag: "🇫🇷", rtl: false },
  de: { label: "Deutsch", flag: "🇩🇪", rtl: false },
  es: { label: "Español", flag: "🇪🇸", rtl: false },
};

type Translations = typeof EN;
const EN = {
  dashboard: "Dashboard",
  jobs: "Jobs",
  timeRecord: "Time Record",
  assignedJobs: "Assigned Jobs",
  supervision: "Live Supervision",
  technicians: "Technicians",
  workshop: "Workshop",
  clockIn: "Clock In",
  clockOut: "Clock Out",
  startShift: "Start Shift",
  endShift: "End Shift",
  totalHours: "Total Hours",
  productivity: "Productivity",
  search: "Search",
  notes: "Notes",
  tasks: "Tasks",
  inspections: "Inspections",
  addNote: "Add Note",
  subject: "Subject",
  attachment: "Attachment",
  save: "Save",
  cancel: "Cancel",
  pending: "Pending",
  inProgress: "In Progress",
  completed: "Completed",
  done: "Done",
  takeAction: "Take Action",
  language: "Language",
  settings: "Settings",
  logout: "Logout",
  attendance: "Attendance",
  export: "Export",
  notifications: "Notifications",
  laborType: "Labor Type",
};

const TRANSLATIONS: Record<LangCode, Translations> = {
  en: EN,
  ar: {
    dashboard: "لوحة التحكم",
    jobs: "الوظائف",
    timeRecord: "سجل الوقت",
    assignedJobs: "الوظائف المعيّنة",
    supervision: "الإشراف المباشر",
    technicians: "الفنيون",
    workshop: "الورشة",
    clockIn: "تسجيل الدخول",
    clockOut: "تسجيل الخروج",
    startShift: "بدء الوردية",
    endShift: "إنهاء الوردية",
    totalHours: "إجمالي الساعات",
    productivity: "الإنتاجية",
    search: "بحث",
    notes: "ملاحظات",
    tasks: "مهام",
    inspections: "فحوصات",
    addNote: "إضافة ملاحظة",
    subject: "الموضوع",
    attachment: "مرفق",
    save: "حفظ",
    cancel: "إلغاء",
    pending: "قيد الانتظار",
    inProgress: "قيد التنفيذ",
    completed: "مكتمل",
    done: "تم",
    takeAction: "اتخاذ إجراء",
    language: "اللغة",
    settings: "الإعدادات",
    logout: "تسجيل الخروج",
    attendance: "الحضور",
    export: "تصدير",
    notifications: "الإشعارات",
    laborType: "نوع العمل",
  },
  fr: {
    dashboard: "Tableau de bord",
    jobs: "Travaux",
    timeRecord: "Relevé de temps",
    assignedJobs: "Travaux assignés",
    supervision: "Supervision en direct",
    technicians: "Techniciens",
    workshop: "Atelier",
    clockIn: "Pointer",
    clockOut: "Dépointer",
    startShift: "Début de service",
    endShift: "Fin de service",
    totalHours: "Total heures",
    productivity: "Productivité",
    search: "Rechercher",
    notes: "Notes",
    tasks: "Tâches",
    inspections: "Inspections",
    addNote: "Ajouter une note",
    subject: "Sujet",
    attachment: "Pièce jointe",
    save: "Enregistrer",
    cancel: "Annuler",
    pending: "En attente",
    inProgress: "En cours",
    completed: "Terminé",
    done: "Fait",
    takeAction: "Agir",
    language: "Langue",
    settings: "Paramètres",
    logout: "Déconnexion",
    attendance: "Présence",
    export: "Exporter",
    notifications: "Notifications",
    laborType: "Type de travail",
  },
  de: { ...EN, dashboard: "Armaturenbrett", jobs: "Aufträge", timeRecord: "Zeiterfassung", technicians: "Techniker", workshop: "Werkstatt", language: "Sprache", logout: "Abmelden", laborType: "Arbeitstyp" },
  es: { ...EN, dashboard: "Panel", jobs: "Trabajos", timeRecord: "Registro de tiempo", technicians: "Técnicos", workshop: "Taller", language: "Idioma", logout: "Cerrar sesión", laborType: "Tipo de trabajo" },
};

interface LanguageContextValue {
  lang: LangCode;
  t: Translations;
  rtl: boolean;
  setLang: (lang: LangCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    AsyncStorage.getItem("igmma_lang").then((saved) => {
      if (saved && LANGUAGES[saved as LangCode]) setLangState(saved as LangCode);
    });
  }, []);

  const setLang = useCallback(async (code: LangCode) => {
    await AsyncStorage.setItem("igmma_lang", code);
    setLangState(code);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, t: TRANSLATIONS[lang], rtl: LANGUAGES[lang].rtl, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be inside LanguageProvider");
  return ctx;
}
