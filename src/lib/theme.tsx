import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "cafe";
const Ctx = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("cafe");

  useEffect(() => {
    let saved = (typeof window !== "undefined" && localStorage.getItem("grasp_theme")) as string | null;
    if (saved === "dark") saved = "cafe"; // migrate old dark users to cafe
    const initial: Theme = (saved as Theme) || "cafe";
    setTheme(initial);
    document.documentElement.classList.remove("dark", "cafe");
    if (initial !== "light") {
      document.documentElement.classList.add(initial);
    }
  }, []);

  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === "light" ? "cafe" : "light";
      document.documentElement.classList.remove("dark", "cafe");
      if (next !== "light") {
        document.documentElement.classList.add(next);
      }
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