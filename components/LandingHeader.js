import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import styles from "../styles/LandingHeader.module.css";

const ABOUT_SUBMENU = [
  { href: "/sobre-nos", label: "Sobre nós" },
  { href: "/#testemunhos", label: "Testemunhos" },
  { href: "/recursos#faq", label: "FAQ" },
  { href: "/sobre-nos#contactos", label: "Contactos" },
];

const RESOURCES_SUBMENU = [
  { href: "/blog", label: "Blog" },
  { href: "/recursos", label: "Recursos" },
];

const DEFAULT_NAV_ITEMS = [
  { href: "/vagas", label: "Vagas" },
  { href: "/candidatos", label: "Candidatos" },
  { href: "/empresas", label: "Empresas" },
  {
    href: "/recursos",
    label: "Recursos",
    hasCaret: true,
    submenu: RESOURCES_SUBMENU,
    submenuKey: "resources",
  },
  { href: "/blog", label: "Blog" },
  {
    href: "/sobre-nos",
    label: "Sobre nós",
    hasCaret: true,
    submenu: ABOUT_SUBMENU,
    submenuKey: "about",
  },
];

const LIGHT_NAV_ITEMS = [
  {
    href: "/sobre-nos",
    label: "Sobre nós",
    hasCaret: true,
    submenu: ABOUT_SUBMENU,
    submenuKey: "about",
  },
  { href: "/vagas", label: "Vagas" },
  { href: "/candidatos", label: "Candidatos", hasCaret: true },
  { href: "/empresas", label: "Empresas", hasCaret: true },
  {
    href: "/recursos",
    label: "Recursos",
    hasCaret: true,
    submenu: RESOURCES_SUBMENU,
    submenuKey: "resources",
  },
];

export default function LandingHeader({ variant = "light" }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenSubmenu, setMobileOpenSubmenu] = useState(null);
  const menuRef = useRef(null);
  const submenuRef = useRef(null);

  const isDashboard = variant === "dashboard";
  const isLight = variant === "light";
  const navItems = isLight ? LIGHT_NAV_ITEMS : DEFAULT_NAV_ITEMS;
  const displayName =
    profile?.fullName || user?.email?.split("@")[0] || "Minha conta";
  const avatarFallback = displayName.charAt(0).toUpperCase() || "U";

  useEffect(() => {
    let active = true;

    async function fetchProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/profile?uid=${user.uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!active || !response.ok) {
          if (active) setProfile(null);
          return;
        }

        const json = await response.json();
        if (active) setProfile(json.profile?.data || null);
      } catch (error) {
        if (active) setProfile(null);
      }
    }

    fetchProfile();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }

      if (submenuRef.current && !submenuRef.current.contains(event.target)) {
        setOpenSubmenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setOpenSubmenu(null);
        setMobileMenuOpen(false);
        setMobileOpenSubmenu(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("modal-open", mobileMenuOpen);

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setOpenSubmenu(null);
    setMobileMenuOpen(false);
    setMobileOpenSubmenu(null);
  }, [router.asPath]);

  function isActiveLink(href) {
    if (!router.pathname) return false;
    if (href === "/") return router.pathname === "/";
    return (
      router.pathname === href ||
      router.pathname.startsWith(`${href}/`) ||
      router.asPath.startsWith(`${href}/`)
    );
  }

  async function handleLogout() {
    const result = await logout();
    setMenuOpen(false);
    setOpenSubmenu(null);
    setMobileMenuOpen(false);
    setMobileOpenSubmenu(null);

    if (result?.success) {
      router.push("/");
    }
  }

  const headerClassName = [
    styles.header,
    isDashboard ? styles.dashboard : isLight ? styles.light : styles.default,
  ].join(" ");

  return (
    <header className={headerClassName}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="EmpregoSTP">
          <span className={styles.brandMark}>
            <Image
              src="/assets/Emprego STP Logo.png"
              alt="EmpregoSTP"
              width={196}
              height={59}
              priority
              sizes="(max-width: 768px) 176px, (max-width: 1200px) 220px, 236px"
              className={styles.logoImage}
            />
          </span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Navegação principal">
          <div className={styles.navLinks}>
            {navItems.map((item) =>
              item.submenu ? (
                <div
                  key={item.href}
                  ref={submenuRef}
                  className={styles.navItemWithDropdown}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSubmenu((current) =>
                        current === item.submenuKey ? null : item.submenuKey,
                      );
                      setMenuOpen(false);
                    }}
                    className={[
                      styles.navLink,
                      styles.navTrigger,
                      isActiveLink(item.href) ? styles.navLinkActive : "",
                      openSubmenu === item.submenuKey
                        ? styles.navTriggerOpen
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-expanded={openSubmenu === item.submenuKey}
                    aria-haspopup="menu"
                    aria-controls={`${item.submenuKey}-nav-menu`}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={styles.navCaret}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path fill="currentColor" d="M5.5 7 10 11l4.5-4" />
                    </svg>
                  </button>

                  {openSubmenu === item.submenuKey ? (
                    <div
                      id={`${item.submenuKey}-nav-menu`}
                      className={styles.navDropdown}
                      role="menu"
                    >
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.href}
                          href={subitem.href}
                          className={styles.navDropdownLink}
                          role="menuitem"
                        >
                          {subitem.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    styles.navLink,
                    isActiveLink(item.href) ? styles.navLinkActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span>{item.label}</span>
                  {item.hasCaret ? (
                    <svg
                      className={styles.navCaret}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path fill="currentColor" d="M5.5 7 10 11l4.5-4" />
                    </svg>
                  ) : null}
                </Link>
              ),
            )}
          </div>

          {!user ? (
            <div className={styles.authActions}>
              {isLight ? (
                <Link href="/login" className={styles.lightLoginButton}>
                  LOGIN
                </Link>
              ) : (
                <>
                  <Link href="/login" className={styles.ghostButton}>
                    Login
                  </Link>
                  <Link href="/escolha-tipo" className={styles.primaryButton}>
                    Criar Conta
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div ref={menuRef} className={styles.profileMenu}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className={[
                  styles.profileButton,
                  menuOpen ? styles.profileButtonOpen : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls="account-menu"
              >
                {profile?.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt="Foto do perfil"
                    className={styles.avatarImage}
                    loading="lazy"
                    decoding="async"
                    width="40"
                    height="40"
                  />
                ) : (
                  <span className={styles.avatarInitial}>{avatarFallback}</span>
                )}

                <span className={styles.profileText}>
                  <span className={styles.profileName}>{displayName}</span>
                  <span className={styles.profileMeta}>Minha conta</span>
                </span>

                <svg
                  className={[
                    styles.chevron,
                    menuOpen ? styles.chevronOpen : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path fill="currentColor" d="M5.5 7 10 11l4.5-4" />
                </svg>
              </button>

              {menuOpen ? (
                <div id="account-menu" className={styles.dropdown} role="menu">
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownHeaderName}>
                      {displayName}
                    </div>
                    <div className={styles.dropdownHeaderEmail}>
                      {user.email}
                    </div>
                  </div>

                  <div className={styles.dropdownBody}>
                    <Link
                      href="/dashboard"
                      className={styles.dropdownLink}
                      role="menuitem"
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className={styles.logoutButton}
                      role="menuitem"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </nav>

        <button
          type="button"
          className={[
            styles.mobileToggle,
            mobileMenuOpen ? styles.mobileToggleOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-main-nav"
        >
          <span className={styles.mobileToggleBars}>
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className={styles.mobileMenu}>
          <nav
            id="mobile-main-nav"
            className={styles.mobileNav}
            aria-label="Navegação móvel"
          >
            {navItems.map((item) =>
              item.submenu ? (
                <div key={item.href} className={styles.mobileNavGroup}>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileOpenSubmenu((current) =>
                        current === item.submenuKey ? null : item.submenuKey,
                      )
                    }
                    className={[
                      styles.mobileNavLink,
                      isActiveLink(item.href) ? styles.mobileNavLinkActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-expanded={mobileOpenSubmenu === item.submenuKey}
                    aria-controls={`mobile-${item.submenuKey}-nav-menu`}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={styles.mobileNavCaret}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path fill="currentColor" d="M5.5 7 10 11l4.5-4" />
                    </svg>
                  </button>

                  {mobileOpenSubmenu === item.submenuKey ? (
                    <div
                      id={`mobile-${item.submenuKey}-nav-menu`}
                      className={styles.mobileSubnav}
                    >
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.href}
                          href={subitem.href}
                          className={styles.mobileSubnavLink}
                        >
                          {subitem.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    styles.mobileNavLink,
                    isActiveLink(item.href) ? styles.mobileNavLinkActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span>{item.label}</span>
                  {item.hasCaret ? (
                    <svg
                      className={styles.mobileNavCaret}
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path fill="currentColor" d="M5.5 7 10 11l4.5-4" />
                    </svg>
                  ) : null}
                </Link>
              ),
            )}
          </nav>

          {!user ? (
            <div className={styles.mobileActions}>
              <Link href="/login" className={styles.mobileGhostButton}>
                Login
              </Link>
              <Link href="/escolha-tipo" className={styles.mobilePrimaryButton}>
                Criar Conta
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.mobileProfile}>
                {profile?.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt="Foto do perfil"
                    className={styles.avatarImage}
                    loading="lazy"
                    decoding="async"
                    width="40"
                    height="40"
                  />
                ) : (
                  <span className={styles.avatarInitial}>{avatarFallback}</span>
                )}
                <div className={styles.mobileProfileMeta}>
                  <div className={styles.mobileProfileName}>{displayName}</div>
                  <div className={styles.mobileProfileEmail}>{user.email}</div>
                </div>
              </div>

              <div className={styles.mobileAccountActions}>
                <Link
                  href="/dashboard"
                  className={styles.mobileSecondaryButton}
                >
                  Abrir dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={styles.mobileDangerButton}
                >
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </header>
  );
}
