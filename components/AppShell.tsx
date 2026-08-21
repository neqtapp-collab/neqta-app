'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Bell,
  Box,
  CircleDollarSign,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Percent,
  Settings,
  SunMoon,
  Tag,
  X,
} from 'lucide-react';

import { routes } from '@/config/routes';
import { createClient } from '@/lib/supabase/client';
import {
  getCurrentContext,
  type CurrentContext,
} from '@/lib/supabase/current-context';

const navigation = [
  [routes.dashboard, 'Visão Geral', Home],
  [routes.products, 'Produtos', Box],
  [routes.costs, 'Custos', CircleDollarSign],
  [routes.pricing, 'Precificação', Tag],
  [routes.promotions, 'Promoções', Percent],
] as const;

function ThemeLogo({ drawer = false }: { drawer?: boolean }) {
  return (
    <>
      <Image
        className={`logo-image logo-image-dark${
          drawer ? ' drawer-logo-image' : ''
        }`}
        src="/brand/logo-dark.png"
        alt="NEQTA"
        width={140}
        height={40}
        priority
      />

      <Image
        className={`logo-image logo-image-light${
          drawer ? ' drawer-logo-image' : ''
        }`}
        src="/brand/logo-light.png"
        alt=""
        width={140}
        height={40}
        priority
      />
    </>
  );
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentContext, setCurrentContext] =
    useState<CurrentContext | null>(null);

  const [light, setLight] = useState(false);
  const [notice, setNotice] = useState(false);
  const [profile, setProfile] = useState(false);
  const [help, setHelp] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [noticePosition, setNoticePosition] = useState({
    top: 60,
    right: 12,
  });

  const [profilePosition, setProfilePosition] = useState({
    top: 60,
    right: 12,
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCurrentContext() {
      const context = await getCurrentContext();

      if (mounted) {
        setCurrentContext(context);
      }
    }

    loadCurrentContext();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setLight(localStorage.getItem('neqta-theme') === 'light');

    const syncTheme = (event: Event) =>
      setLight(
        (event as CustomEvent<string>).detail === 'light',
      );

    window.addEventListener(
      'neqta-theme-change',
      syncTheme,
    );

    return () =>
      window.removeEventListener(
        'neqta-theme-change',
        syncTheme,
      );
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      'light',
      light,
    );

    return () =>
      document.documentElement.classList.remove('light');
  }, [light]);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const closePopovers = (event: MouseEvent) => {
      if (
        !popoverRef.current?.contains(
          event.target as Node,
        ) &&
        !noticeRef.current?.contains(
          event.target as Node,
        ) &&
        !profileRef.current?.contains(
          event.target as Node,
        )
      ) {
        setNotice(false);
        setProfile(false);
      }
    };

    document.addEventListener(
      'mousedown',
      closePopovers,
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        closePopovers,
      );
  }, []);

  useEffect(() => {
    if (!notice) return;

    const position = () => {
      const rect =
        bellRef.current?.getBoundingClientRect();

      const headerBottom =
        document
          .querySelector('.app-header')
          ?.getBoundingClientRect().bottom ??
        rect?.bottom ??
        0;

      if (rect) {
        setNoticePosition({
          top: Math.max(
            rect.bottom + 6,
            headerBottom + 4,
          ),
          right: Math.max(
            12,
            window.innerWidth - rect.right,
          ),
        });
      }
    };

    position();

    window.addEventListener('resize', position);
    window.addEventListener(
      'scroll',
      position,
      true,
    );

    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener(
        'scroll',
        position,
        true,
      );
    };
  }, [notice]);

  useEffect(() => {
    if (!profile) return;

    const position = () => {
      const rect =
        profileButtonRef.current?.getBoundingClientRect();

      const headerBottom =
        document
          .querySelector('.app-header')
          ?.getBoundingClientRect().bottom ??
        rect?.bottom ??
        0;

      if (rect) {
        setProfilePosition({
          top: Math.max(
            rect.bottom + 6,
            headerBottom + 4,
          ),
          right: Math.max(
            12,
            window.innerWidth - rect.right,
          ),
        });
      }
    };

    position();

    window.addEventListener('resize', position);
    window.addEventListener(
      'scroll',
      position,
      true,
    );

    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener(
        'scroll',
        position,
        true,
      );
    };
  }, [profile]);

  useEffect(() => {
    if (!drawer) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const getFocusableElements = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      );

    window.setTimeout(
      () => getFocusableElements()[0]?.focus(),
      0,
    );

    const handleKeyboard = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setDrawer(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = getFocusableElements();

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyboard,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        'keydown',
        handleKeyboard,
      );

      menuButtonRef.current?.focus();
    };
  }, [drawer]);

  function toggleTheme() {
    setLight((currentTheme) => {
      const nextTheme = !currentTheme;

      localStorage.setItem(
        'neqta-theme',
        nextTheme ? 'light' : 'dark',
      );

      return nextTheme;
    });
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setProfile(false);
    setDrawer(false);

    const supabase = createClient();

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        'Erro ao sair da conta:',
        error,
      );

      setLoggingOut(false);
      return;
    }

    setCurrentContext(null);

    router.replace('/login');
    router.refresh();
  }

  function navigationLinks(
    closeDrawer = false,
  ) {
    return navigation.map(
      ([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          className={
            pathname === href ? 'active' : ''
          }
          aria-current={
            pathname === href
              ? 'page'
              : undefined
          }
          onClick={
            closeDrawer
              ? () => setDrawer(false)
              : undefined
          }
        >
          <Icon />
          {label}
        </Link>
      ),
    );
  }

  const companyName =
    currentContext?.companyName ??
    'Minha empresa';

  const initials =
    currentContext?.initials ?? 'NE';

  return (
    <div
      className={
        light ? 'app light' : 'app'
      }
    >
      <aside className="desktop-sidebar">
        <Link
          className="logo"
          href={routes.dashboard}
          aria-label="NEQTA — Visão Geral"
        >
          <ThemeLogo />
        </Link>

        <nav>{navigationLinks()}</nav>

        <div className="nav-separator" />

        <Link
          href={routes.settings}
          className={
            pathname === routes.settings
              ? 'active'
              : ''
          }
          aria-current={
            pathname === routes.settings
              ? 'page'
              : undefined
          }
        >
          <Settings />
          Configurações
        </Link>

        <div className="side-spacer" />

        <button
          className="help-link"
          onClick={() => setHelp(true)}
        >
          <HelpCircle />
          Central de ajuda
        </button>
      </aside>

      <header className="app-header">
        <div className="mobile-left">
          <button
            ref={menuButtonRef}
            className="menu-button"
            aria-label="Abrir menu"
            aria-controls="mobile-drawer"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Menu />
          </button>
        </div>

        <div className="mobile-brand">
          <Link
            href={routes.dashboard}
            aria-label="NEQTA — Visão Geral"
          >
            <span className="mobile-wordmark">
              NEQTA
            </span>

            <Image
              className="mobile-logo mobile-logo-dark"
              src="/brand/mobile-logo-dark.png"
              width={34}
              height={34}
              alt="NEQTA"
              priority
            />

            <Image
              className="mobile-logo mobile-logo-light"
              src="/brand/mobile-logo-light.png"
              width={34}
              height={34}
              alt=""
              priority
            />
          </Link>
        </div>

        <div
          className="top-content"
          ref={popoverRef}
        >
          <button
            title="Alternar tema"
            aria-label="Alternar tema"
            onClick={toggleTheme}
          >
            <SunMoon />
          </button>

          <button
            ref={bellRef}
            className="bell"
            aria-label="Abrir notificações"
            aria-expanded={notice}
            onClick={() => {
              setNotice(
                (current) => !current,
              );
              setProfile(false);
            }}
          >
            <Bell />
            <i />
          </button>

          <button
            ref={profileButtonRef}
            className="avatar"
            aria-label="Abrir menu da empresa"
            aria-expanded={profile}
            onClick={() => {
              setProfile(
                (current) => !current,
              );
              setNotice(false);
            }}
          >
            {initials}
          </button>

          {notice &&
            typeof document !==
              'undefined' &&
            createPortal(
              <div
                ref={noticeRef}
                className={`popover notices global-notice-popover${
                  light
                    ? ' light-popover'
                    : ''
                }`}
                style={{
                  top: noticePosition.top,
                  right:
                    noticePosition.right,
                }}
              >
                <h3>Notificações</h3>

                <p>
                  Carne bovina subiu 14,3%
                </p>

                <p>
                  3 produtos precisam de
                  reajuste
                </p>

                <p>
                  3 oportunidades de promoção
                </p>

                <Link
                  className="action-row"
                  href={routes.notifications}
                >
                  <span className="action-row-label">
                    Ver todas
                  </span>

                  <span className="action-row-icon">
                    <ArrowRight />
                  </span>
                </Link>
              </div>,
              document.body,
            )}

          {profile &&
            typeof document !==
              'undefined' &&
            createPortal(
              <div
                ref={profileRef}
                className={`popover profile global-profile-popover${
                  light
                    ? ' light-popover'
                    : ''
                }`}
                style={{
                  top: profilePosition.top,
                  right:
                    profilePosition.right,
                }}
              >
                <h3>{companyName}</h3>

                <Link
                  href={`${routes.settings}?tab=empresa`}
                >
                  Minha empresa
                </Link>

                <Link
                  href={routes.settings}
                >
                  Configurações
                </Link>

                <Link
                  href={`${routes.settings}?tab=assinatura`}
                >
                  Assinatura
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut />
                  {loggingOut
                    ? 'Saindo...'
                    : 'Sair'}
                </button>
              </div>,
              document.body,
            )}
        </div>
      </header>

      <div
        className={
          drawer
            ? 'drawer-layer open'
            : 'drawer-layer'
        }
        aria-hidden={!drawer}
      >
        <button
          className="drawer-backdrop"
          tabIndex={drawer ? 0 : -1}
          aria-label="Fechar menu"
          onClick={() =>
            setDrawer(false)
          }
        />

        <section
          ref={drawerRef}
          id="mobile-drawer"
          className="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          <div className="drawer-heading">
            <Link
              className="drawer-logo"
              href={routes.dashboard}
              aria-label="NEQTA — Visão Geral"
              onClick={() =>
                setDrawer(false)
              }
            >
              <ThemeLogo drawer />
            </Link>

            <button
              aria-label="Fechar menu"
              onClick={() =>
                setDrawer(false)
              }
            >
              <X />
            </button>
          </div>

          <div className="drawer-content">
            <nav>
              {navigationLinks(true)}
            </nav>

            <div className="drawer-separator" />

            <Link
              href={routes.settings}
              className={
                pathname ===
                routes.settings
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setDrawer(false)
              }
            >
              <Settings />
              Configurações
            </Link>

            <button
              className="drawer-link"
              onClick={() => {
                setDrawer(false);
                setHelp(true);
              }}
            >
              <HelpCircle />
              Central de ajuda
            </button>
          </div>

          <footer className="drawer-footer">
            <div className="drawer-account">
              <span className="avatar">
                {initials}
              </span>

              <span>
                <b>{companyName}</b>
                <small>
                  Plano Premium
                </small>
              </span>
            </div>

            <Link
              href={`${routes.settings}?tab=empresa`}
              onClick={() =>
                setDrawer(false)
              }
            >
              Minha empresa
            </Link>

            <Link
              href={`${routes.settings}?tab=assinatura`}
              onClick={() =>
                setDrawer(false)
              }
            >
              Assinatura
            </Link>

            <button
              type="button"
              className="drawer-link"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut />
              {loggingOut
                ? 'Saindo...'
                : 'Sair'}
            </button>
          </footer>
        </section>
      </div>

      <main>
        <div className="content">
          {children}
        </div>
      </main>

      <nav className="bottom">
        {navigationLinks()}
      </nav>

      {help && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() =>
            setHelp(false)
          }
        >
          <div
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Central de ajuda"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              aria-label="Fechar ajuda"
              onClick={() =>
                setHelp(false)
              }
            >
              ×
            </button>

            <h2>Central de ajuda</h2>

            <p>
              Encontre orientação sobre
              produtos, custos, precificação e
              promoções.
            </p>

            <Link href={routes.settings}>
              Abrir configurações
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}