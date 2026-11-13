import { createContext, useContext, useEffect, type ReactNode } from "react";
import { en, type TKey } from "./translations";

export type Lang = "en";
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.localStorage.setItem("lang", "en");
    document.documentElement.lang = "en";
  }, []);
  return <Ctx.Provider value={{ lang: "en", setLang: () => {}, t: (k) => en[k] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
