import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
  FiChevronRight,
  FiGrid,
  FiBookOpen,
  FiDollarSign,
  FiSettings,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { DashboardShellProvider } from '../../context/DashboardShellContext';
import { getDashboardNav, ROLE_LABEL } from './dashboardNav';
import { buildLoginUrl } from '../../lib/loginRedirect';

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
  grid: FiGrid,
  book: FiBookOpen,
  dollar: FiDollarSign,
  settings: FiSettings,
};

const THEME_KEY = 'estp-theme';

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    const bootstrappedTheme =
      window.document.documentElement.dataset.dashboardTheme;
    if (bootstrappedTheme === 'dark' || bootstrappedTheme === 'light') {
      return bootstrappedTheme;
    }
    return 'light';
  } catch (error) {
    return 'light';
  }
}

/** Animated number counter used inside stat cards. */
export function Counter({ value, duration = 1100, className }) {
  const [display, setDisplay] = useState(0);
  const target = Number(value) || 0;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
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

  return <span className={className}>{display.toLocaleString('pt-PT')}</span>;
}

export default function DashboardShell({
  role = 'admin',
  active,
  title,
  subtitle,
  profile = {},
  navBadges = {},
  nav: navOverride,
  sidebarTop,
  sidebarFooter,
  showThemeToggle = true,
  themeMode,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  topbarActions,
  onLogout,
  profileInTopbar,
  onProfileClick,
  children,
}) {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [theme, setTheme] = useState(readStoredTheme);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const syncTheme = (event) => {
      if (
        event.key === THEME_KEY &&
        (event.newValue === 'dark' || event.newValue === 'light')
      ) {
        setTheme(event.newValue);
      }
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
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
    router.events?.on('routeChangeStart', close);
    return () => router.events?.off('routeChangeStart', close);
  }, [router.events]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      sidebarRef.current?.querySelector('button, a')?.focus();
    }, 0);

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('modal-open');

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('modal-open');
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [sidebarOpen]);

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
    router.push(buildLoginUrl(router.asPath));
  }, [onLogout, logout, router]);

  const nav = navOverride || getDashboardNav(role);
  const resolvedTheme = themeMode || theme;

  useEffect(() => {
    document.documentElement.dataset.dashboardTheme = resolvedTheme;
  }, [resolvedTheme]);

  const fallbackAccountName =
    user?.displayName || user?.email?.split('@')[0] || ROLE_LABEL[role];
  const profileName =
    profile.name && profile.name !== ROLE_LABEL[role]
      ? profile.name
      : fallbackAccountName || profile.name || ROLE_LABEL[role];
  const profileAvatarUrl = profile.avatarUrl || user?.photoURL || undefined;
  const resolvedProfileInTopbar = profileInTopbar ?? role === 'empresa';
  const initials = (profileName || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const profileActionLabel =
    role === 'candidato'
      ? 'Abrir meu perfil'
      : role === 'empresa'
        ? 'Abrir perfil da empresa'
        : `Perfil de ${profileName}`;

  function handleProfileClick() {
    if (onProfileClick) {
      onProfileClick();
      return;
    }

    if (role === 'empresa') {
      router.push('/dashboard/empresa/profile');
      return;
    }

    if (role === 'candidato') {
      router.push('/dashboard/candidato?tab=profile');
    }
  }

  return (
    <div
      className={`dashShell role-${role}${sidebarOpen ? ' sidebar-open' : ''}`}
      data-theme={resolvedTheme}
      suppressHydrationWarning
    >
      <a className="dash-skip-link" href="#dashboard-content">
        Saltar para o conteúdo
      </a>
      {sidebarOpen && (
        <div
          className="dash-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className="dash-sidebar"
        id="dashboard-navigation"
        aria-label={`Navegação do painel de ${ROLE_LABEL[role] || 'utilizador'}`}
      >
        <button
          type="button"
          className="dash-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        >
          <FiX />
        </button>
        <Link
          href="/"
          className="dash-sidebar-logo"
          aria-label="Ir para a página inicial"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/Emprego STP Logo.png" alt="EmpregoSTP" />
        </Link>

        {!resolvedProfileInTopbar && (
          <>
            <div className="dash-sidebar-profile">
              <div className="dash-profile-avatar">
                {profileAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileAvatarUrl} alt={profileName || 'Perfil'} />
                ) : (
                  initials
                )}
              </div>
              <div className="dash-profile-copy">
                <div className="dash-profile-name">{profileName}</div>
                <div className="dash-profile-role">
                  {profile.role || ROLE_LABEL[role]}
                </div>
              </div>
              {profile.plan && (
                <span className="dash-plan-pill">{profile.plan}</span>
              )}
            </div>

            <div className="dash-sidebar-divider" />
          </>
        )}

        {sidebarTop}

        <nav className="dash-nav">
          {nav.map((section) => (
            <div key={section.label}>
              {section.label && (
                <div className="dash-nav-label">{section.label}</div>
              )}
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] || FiHome;
                const isActive = active === item.key;
                const badge =
                  item.badge != null ? item.badge : navBadges[item.key];
                const inner = (
                  <>
                    <span className="dash-nav-icon">
                      <Icon />
                    </span>
                    {item.label}
                    {badge ? (
                      <span
                        className={`dash-nav-badge${item.badgeStyle === 'lime' ? ' lime' : ''}`}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </>
                );
                const cls = `dash-nav-item${isActive ? ' active' : ''}`;
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
                      aria-current={isActive ? 'page' : undefined}
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
                    aria-current={isActive ? 'page' : undefined}
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
          <button
            type="button"
            className="dash-logout-btn"
            onClick={handleLogout}
          >
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
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-controls="dashboard-navigation"
            aria-expanded={sidebarOpen}
          >
            <FiMenu />
          </button>
          <div>
            <div className="dash-topbar-title">{title}</div>
            {subtitle && <div className="dash-topbar-sub">{subtitle}</div>}
          </div>
          <div className="dash-topbar-spacer" />
          {searchPlaceholder && typeof onSearchChange === 'function' && (
            <label className="dash-topbar-search-wrap">
              <FiSearch aria-hidden="true" />
              <span className="dash-visually-hidden">Pesquisar no painel</span>
              <input
                className="dash-topbar-search"
                placeholder={searchPlaceholder}
                type="search"
                value={searchValue || ''}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          )}
          {topbarActions}
          {showThemeToggle && (
            <button
              type="button"
              className="dash-theme-btn"
              onClick={toggleTheme}
              aria-pressed={resolvedTheme === 'dark'}
              aria-label={
                resolvedTheme === 'dark'
                  ? 'Usar tema claro'
                  : 'Usar tema escuro'
              }
              title={
                resolvedTheme === 'dark'
                  ? 'Usar tema claro'
                  : 'Usar tema escuro'
              }
            >
              {resolvedTheme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
          )}
          {resolvedProfileInTopbar && (
            <>
              <span className="dash-topbar-sep" aria-hidden="true" />
              <button
                type="button"
                className="dash-topbar-profile"
                onClick={handleProfileClick}
                aria-label={profileActionLabel}
                title={profileActionLabel}
              >
                <span className="dash-topbar-profile-copy">
                  <span className="dash-topbar-profile-name">
                    {profileName}
                  </span>
                  <span className="dash-topbar-profile-role">
                    {profile.role || ROLE_LABEL[role]}
                  </span>
                </span>
                {profile.plan ? (
                  <span className="dash-topbar-profile-plan">
                    {profile.plan}
                  </span>
                ) : null}
                <span className="dash-topbar-profile-avatar">
                  {profileAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileAvatarUrl} alt={profileName || 'Perfil'} />
                  ) : (
                    initials
                  )}
                </span>
                <FiChevronRight
                  className="dash-topbar-profile-chevron"
                  aria-hidden="true"
                />
              </button>
            </>
          )}
        </header>

        <main className="dash-content" id="dashboard-content">
          <DashboardShellProvider value>{children}</DashboardShellProvider>
        </main>
      </div>
    </div>
  );
}
