import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "mocha" | "latte" | "cappuccino" | "matcha";
const Ctx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("cappuccino");

  useEffect(() => {
    let saved = (typeof window !== "undefined" && localStorage.getItem("grasp_theme")) as string | null;
    if (!saved || saved === "light" || saved === "dark" || saved === "cafe") saved = "cappuccino";
    const initial: Theme = saved as Theme;
    setTheme(initial);
    document.documentElement.classList.remove("light", "dark", "cafe", "mocha", "latte", "cappuccino", "matcha");
    document.documentElement.classList.add(initial);
  }, []);

  const toggle = () => {
    setTheme((t) => {
      let next: Theme;
      if (t === "cappuccino") next = "mocha";
      else if (t === "mocha") next = "matcha";
      else if (t === "matcha") next = "latte";
      else next = "cappuccino";
      
      document.documentElement.classList.remove("mocha", "latte", "cappuccino", "matcha");
      document.documentElement.classList.add(next);
      localStorage.setItem("grasp_theme", next);
      return next;
    });
  };

  const setThemeDirect = (next: Theme) => {
    setTheme(() => {
      document.documentElement.classList.remove("mocha", "latte", "cappuccino", "matcha");
      document.documentElement.classList.add(next);
      localStorage.setItem("grasp_theme", next);
      return next;
    });
  };

  return <Ctx.Provider value={{ theme, toggle, setTheme: setThemeDirect }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be inside ThemeProvider");
  return c;
}