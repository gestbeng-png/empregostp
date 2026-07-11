import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  FiHome,
  FiUsers,
  FiBriefcase,
  FiShield,
  FiBarChart2,
  FiFileText,
  FiRss,
  FiFolder,
  FiTool,
  FiStar,
  FiCreditCard,
  FiInbox,
  FiList,
  FiSend,
  FiBookmark,
  FiSearch,
  FiUser,
  FiPlusCircle,
  FiMessageSquare,
  FiBell,
  FiCheckSquare,
  FiCalendar,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiSun,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { DashboardShellProvider } from "../../context/DashboardShellContext";
import { getDashboardNav, ROLE_LABEL } from "./dashboardNav";

const ICONS = {
  home: FiHome,
  users: FiUsers,
  briefcase: FiBriefcase,
  shield: FiShield,
  chart: FiBarChart2,
  fileText: FiFileText,
  rss: FiRss,
  folder: FiFolder,
  tool: FiTool,
  star: FiStar,
  creditCard: FiCreditCard,
  inbox: FiInbox,
  list: FiList,
  send: FiSend,
  bookmark: FiBookmark,
  search: FiSearch,
  user: FiUser,
  plus: FiPlusCircle,
  messages: FiMessageSquare,
  bell: FiBell,
  verification: FiCheckSquare,
  calendar: FiCalendar,
};

const THEME_KEY = "estp-theme";

/** Animated number counter used inside stat cards. */
export function Counter({ value, duration = 1100, className }) {
  const [display, setDisplay] = useState(0);
  const target = Number(value) || 0;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const step = (now) => {
      const raw = Math.min((now - start) / duration, 1);
      const eased = raw === 1 ? 1 : 1 - Math.pow(2, -10 * raw);
      setDisplay(Math.round(target * eased));
      if (raw < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span className={className}>{display.toLocaleString("pt-PT")}</span>;
}

export default function DashboardShell({
  role = "admin",
  active,
  title,
  subtitle,
  profile = {},
  navBadges = {},
  nav: navOverride,
  sidebarTop,
  sidebarFooter,
  showThemeToggle = true,
  searchPlaceholder,
  topbarActions,
  onLogout,
  children,
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [theme, setTheme] = useState("light");
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const shellRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "dark" || stored === "light") setTheme(stored);
    } catch (error) {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (error) {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Close mobile sidebar on route change.
  useEffect(() => {
    const close = () => setSidebarOpen(false);
    router.events?.on("routeChangeStart", close);
    return () => router.events?.off("routeChangeStart", close);
  }, [router.events]);

  const handleLogout = useCallback(async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await logout();
    } catch (error) {
      /* best effort */
    }
    router.push("/login");
  }, [onLogout, logout, router]);

  const nav = navOverride || getDashboardNav(role);
  const initials = (profile.name || ROLE_LABEL[role] || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      ref={shellRef}
      className={`dashShell role-${role}${sidebarOpen ? " sidebar-open" : ""}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      {sidebarOpen && (
        <div
          className="dash-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className="dash-sidebar">
        <button
          type="button"
          className="dash-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        >
          <FiX />
        </button>
        <Link href="/" className="dash-sidebar-logo" aria-label="Ir para a página inicial">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/Emprego STP Logo.png" alt="EmpregoSTP" />
        </Link>

        <div className="dash-sidebar-profile">
          <div className="dash-profile-avatar">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.name || "Perfil"} />
            ) : (
              initials
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="dash-profile-name">{profile.name || ROLE_LABEL[role]}</div>
            <div className="dash-profile-role">{profile.role || ROLE_LABEL[role]}</div>
          </div>
          {profile.plan && <span className="dash-plan-pill">{profile.plan}</span>}
        </div>

        <div className="dash-sidebar-divider" />

        {sidebarTop}

        <nav className="dash-nav">
          {nav.map((section) => (
            <div key={section.label}>
              {section.label && <div className="dash-nav-label">{section.label}</div>}
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] || FiHome;
                const isActive = active === item.key;
                const badge = item.badge != null ? item.badge : navBadges[item.key];
                const inner = (
                  <>
                    <span className="dash-nav-icon">
                      <Icon />
                    </span>
                    {item.label}
                    {badge ? (
                      <span
                        className={`dash-nav-badge${item.badgeStyle === "lime" ? " lime" : ""}`}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </>
                );
                const cls = `dash-nav-item${isActive ? " active" : ""}`;
                if (item.onClick) {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={cls}
                      onClick={() => {
                        item.onClick();
                        setSidebarOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cls}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          {sidebarFooter}
          <button type="button" className="dash-logout-btn" onClick={handleLogout}>
            <FiLogOut /> Sair
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-icon-btn dash-menu-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <FiMenu />
          </button>
          <div>
            <div className="dash-topbar-title">{title}</div>
            {subtitle && <div className="dash-topbar-sub">{subtitle}</div>}
          </div>
          <div className="dash-topbar-spacer" />
          {searchPlaceholder && typeof onSearchChange === "function" && (
            <input
              className="dash-topbar-search"
              placeholder={searchPlaceholder}
              aria-label="Pesquisar"
              type="text"
              value={searchValue || ""}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          )}
          {topbarActions}
          {showThemeToggle && (
            <button
              type="button"
              className="dash-theme-btn"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              title="Alternar tema"
            >
              {theme === "dark" ? <FiSun /> : <FiMoon />}
            </button>
          )}
        </header>

        <main className="dash-content" id="dashboard-content">
          <DashboardShellProvider value>{children}</DashboardShellProvider>
        </main>
      </div>
    </div>
  );
}
