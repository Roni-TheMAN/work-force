import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "admin-dashboard-theme";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const nextThemeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <main className="dashboard-shell">
      <section className="dashboard-panel">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-kicker">Admin Web</p>
            <h1>Dashboard Overview</h1>
            <p className="dashboard-copy">
              Dark mode now applies across the admin dashboard and persists across visits.
            </p>
          </div>
          <button
            type="button"
            className="theme-toggle"
            aria-label={nextThemeLabel}
            title={nextThemeLabel}
            onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </header>

        <section className="stats-grid" aria-label="Dashboard summary">
          <article className="stat-card">
            <span className="stat-label">Theme</span>
            <strong>{theme === "dark" ? "Dark" : "Light"}</strong>
            <p>Saved locally so the dashboard reopens in your last selected mode.</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Accessibility</span>
            <strong>Color aware</strong>
            <p>The page updates the browser color scheme for form controls and scrollbars.</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Default behavior</span>
            <strong>System aware</strong>
            <p>First load respects the device preference before any manual toggle is saved.</p>
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
