import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "mocha" | "latte";
const Ctx = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("mocha");

  useEffect(() => {
    let saved = (typeof window !== "undefined" && localStorage.getItem("grasp_theme")) as string | null;
    if (!saved || saved === "light" || saved === "dark" || saved === "cafe") saved = "mocha";
    const initial: Theme = saved as Theme;
    setTheme(initial);
    document.documentElement.classList.remove("light", "dark", "cafe", "mocha", "latte");
    document.documentElement.classList.add(initial);
  }, []);

  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === "mocha" ? "latte" : "mocha";
      document.documentElement.classList.remove("mocha", "latte");
      document.documentElement.classList.add(next);
      localStorage.setItem("grasp_theme", next);
      return next;
    });
  };

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be inside ThemeProvider");
  return c;
}