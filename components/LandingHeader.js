import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/LandingHeader.module.css';

const NAV_ITEMS = [
  { href: '/vagas', label: 'Vagas' },
  { href: '/candidatos', label: 'Candidatos' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/blog', label: 'Blog' },
  { href: '/sobre-nos', label: 'Sobre nós' },
];

export default function LandingHeader({ variant = 'default' }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isDashboard = variant === 'dashboard';
  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'Minha conta';
  const avatarFallback = displayName.charAt(0).toUpperCase() || 'U';

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
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [router.asPath]);

  function isActiveLink(href) {
    if (!router.pathname) return false;
    if (href === '/') return router.pathname === '/';
    return router.pathname === href || router.pathname.startsWith(`${href}/`) || router.asPath.startsWith(`${href}/`);
  }

  async function handleLogout() {
    const result = await logout();
    setMenuOpen(false);
    setMobileMenuOpen(false);

    if (result?.success) {
      router.push('/');
    }
  }

  const headerClassName = [styles.header, isDashboard ? styles.dashboard : styles.default].join(' ');

  return (
    <header className={headerClassName}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="EmpregoSTP">
          <img
            src="/assets/Emprego STP Logo (2) 1.png"
            alt="empregoSTP"
            className={styles.logoImage}
          />
        </Link>

        <nav className={styles.desktopNav} aria-label="Navegação principal">
          <div className={styles.navLinks}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[styles.navLink, isActiveLink(item.href) ? styles.navLinkActive : ''].filter(Boolean).join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {!user ? (
            <div className={styles.authActions}>
              <Link href="/login" className={styles.ghostButton}>
                Login
              </Link>
              <Link href="/escolha-tipo" className={styles.primaryButton}>
                Criar Conta
              </Link>
            </div>
          ) : (
            <div ref={menuRef} className={styles.profileMenu}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className={[styles.profileButton, menuOpen ? styles.profileButtonOpen : ''].filter(Boolean).join(' ')}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} alt="Foto do perfil" className={styles.avatarImage} />
                ) : (
                  <span className={styles.avatarInitial}>{avatarFallback}</span>
                )}

                <span className={styles.profileText}>
                  <span className={styles.profileName}>{displayName}</span>
                  <span className={styles.profileMeta}>Minha conta</span>
                </span>

                <svg
                  className={[styles.chevron, menuOpen ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path fill="currentColor" d="M5.5 7 10 11l4.5-4" />
                </svg>
              </button>

              {menuOpen ? (
                <div className={styles.dropdown} role="menu">
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownHeaderName}>{displayName}</div>
                    <div className={styles.dropdownHeaderEmail}>{user.email}</div>
                  </div>

                  <div className={styles.dropdownBody}>
                    <Link href="/dashboard" className={styles.dropdownLink} role="menuitem">
                      Dashboard
                    </Link>
                    <button type="button" onClick={handleLogout} className={styles.logoutButton} role="menuitem">
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
          className={[styles.mobileToggle, mobileMenuOpen ? styles.mobileToggleOpen : ''].filter(Boolean).join(' ')}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileMenuOpen}
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
          <nav className={styles.mobileNav} aria-label="Navegação móvel">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[styles.mobileNavLink, isActiveLink(item.href) ? styles.mobileNavLinkActive : ''].filter(Boolean).join(' ')}
              >
                {item.label}
              </Link>
            ))}
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
                  <img src={profile.photoUrl} alt="Foto do perfil" className={styles.avatarImage} />
                ) : (
                  <span className={styles.avatarInitial}>{avatarFallback}</span>
                )}
                <div className={styles.mobileProfileMeta}>
                  <div className={styles.mobileProfileName}>{displayName}</div>
                  <div className={styles.mobileProfileEmail}>{user.email}</div>
                </div>
              </div>

              <div className={styles.mobileAccountActions}>
                <Link href="/dashboard" className={styles.mobileSecondaryButton}>
                  Abrir dashboard
                </Link>
                <button type="button" onClick={handleLogout} className={styles.mobileDangerButton}>
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
