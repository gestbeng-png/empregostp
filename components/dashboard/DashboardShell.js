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
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
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

/**
 * Lightweight, theme-aware particle field ported from the design's
 * animations.js. Cleans up on unmount and honours reduced-motion.
 */
function useParticles(canvasRef, enabled, theme) {
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const mouse = { x: -999, y: -999 };
    let dots = [];
    let raf;
    const COUNT = 46;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };

    const spawn = () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.5,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.4 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    });

    resize();
    for (let i = 0; i < COUNT; i += 1) dots.push(spawn());
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = themeRef.current === "dark";
      const dotCol = dark ? "95,184,245" : "32,87,215";
      const lineCol = dark ? "95,184,245" : "32,87,215";
      const mouseCol = dark ? "217,255,47" : "95,184,245";

      dots.forEach((d, i) => {
        d.pulse += 0.012;
        const breathe = 1 + 0.25 * Math.sin(d.pulse);
        const mdx = d.x - mouse.x;
        const mdy = d.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 90) {
          const force = (1 - mdist / 90) * 0.6;
          d.vx += (mdx / mdist) * force * 0.08;
          d.vy += (mdy / mdist) * force * 0.08;
        }
        d.vx *= 0.985;
        d.vy *= 0.985;
        const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
        if (spd > 0.7) {
          d.vx = (d.vx / spd) * 0.7;
          d.vy = (d.vy / spd) * 0.7;
        }
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;

        dots.slice(i + 1).forEach((e) => {
          const dx = d.x - e.x;
          const dy = d.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${lineCol},${0.07 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(e.x, e.y);
            ctx.stroke();
          }
        });

        if (mdist < 130) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${mouseCol},${0.12 * (1 - mdist / 130)})`;
          ctx.lineWidth = 1;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * breathe, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotCol},${d.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      dots = [];
    };
  }, [canvasRef, enabled, theme]);
}

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
  particles = true,
  children,
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [theme, setTheme] = useState("light");
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canvasRef = useRef(null);
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

  useParticles(canvasRef, particles && mounted, theme);

  // Close mobile sidebar on route change.
  useEffect(() => {
    const close = () => setSidebarOpen(false);
    router.events?.on("routeChangeStart", close);
    return () => router.events?.off("routeChangeStart", close);
  }, [router.events]);

  // Ripple effect on dashboard buttons.
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return undefined;
    const handler = (e) => {
      const btn = e.target.closest(".btn");
      if (!btn || !root.contains(btn)) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const span = document.createElement("span");
      span.className = "dash-ripple";
      span.style.cssText = `width:${size}px;height:${size}px;left:${
        e.clientX - rect.left - size / 2
      }px;top:${e.clientY - rect.top - size / 2}px;`;
      btn.appendChild(span);
      setTimeout(() => span.remove(), 600);
    };
    root.addEventListener("pointerdown", handler);
    return () => root.removeEventListener("pointerdown", handler);
  }, []);

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
      {particles && <canvas ref={canvasRef} className="dash-particles" aria-hidden="true" />}

      {sidebarOpen && (
        <div
          className="dash-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className="dash-sidebar">
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
          {searchPlaceholder && (
            <input
              className="dash-topbar-search"
              placeholder={searchPlaceholder}
              aria-label="Pesquisar"
              type="text"
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

        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}
