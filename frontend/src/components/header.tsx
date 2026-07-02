import { useState, useRef, useEffect } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { signOutFn } from "../lib/auth/functions";
import { Avatar } from "./avatar";
import Logo from "./logo";
import { Button } from "./ui/button";

const NAV_LINK =
  "text-[14.5px] font-semibold no-underline cursor-pointer transition-colors duration-140 ease-in-out whitespace-nowrap hover:text-(--ink)";

const PRIMARY_BTN =
  "appearance-none border-0 font-sans font-bold text-[14px] rounded-full py-2.5 px-4 cursor-pointer inline-flex items-center justify-center gap-2.25 leading-none whitespace-nowrap no-underline bg-(--accent) text-white shadow-(--sh-pop) transition-[transform,box-shadow,background] duration-160 hover:-translate-y-0.5 hover:bg-(--accent-deep) active:translate-y-0 max-[480px]:p-0 max-[480px]:w-10.5 max-[480px]:h-10.5 max-[480px]:shrink-0";

const MENU_ITEM =
  "flex items-center gap-2.5 w-full py-2.75 px-3 rounded-(--r-sm) border-0 bg-transparent appearance-none text-[14.5px] font-semibold text-(--ink) font-[inherit] cursor-pointer text-left transition-[background] duration-120 hover:bg-(--accent-tint) focus:outline-none focus-visible:bg-(--accent-tint) focus-visible:shadow-[inset_0_0_0_1.5px_var(--accent)]";

export default function Header() {
  const router = useRouter();
  const user = useRouterState({ select: (s) => s.matches[0]?.context?.user });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOutFn();
    router.invalidate();
  }

  const { t } = useLingui();

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    t`You`;

  return (
    <header className="sticky top-0 z-50 border-b border-(--line) bg-[rgba(251,244,233,0.82)] backdrop-blur-md">
      <div className="mx-auto grid h-17.5 max-w-295 grid-cols-[1fr_auto_1fr] items-center gap-4 pr-[max(var(--web-gutter),env(safe-area-inset-right))] pl-[max(var(--web-gutter),env(safe-area-inset-left))] max-[720px]:h-15 max-[720px]:gap-3 max-[480px]:grid-cols-[auto_1fr] max-[480px]:gap-3">
        {/* Logo — left column */}
        <Link to="/" className="justify-self-start text-inherit no-underline">
          <Logo size={20} />
        </Link>

        {/* Nav links — center column */}
        <nav className="flex items-center gap-6.5 max-[720px]:gap-4 max-[480px]:hidden">
          {user && (
            <Link
              to="/events"
              className={NAV_LINK}
              activeProps={{ className: "text-(--ink)" }}
              inactiveProps={{ className: "text-(--ink-soft)" }}
            >
              <Trans>My events</Trans>
            </Link>
          )}
        </nav>

        {/* Right — right column */}
        <div className="flex items-center gap-3.5 justify-self-end max-[480px]:gap-2">
          {user ? (
            <>
              <Link to="/create" className={PRIMARY_BTN}>
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="max-[480px]:hidden">
                  <Trans>New event</Trans>
                </span>
              </Link>

              <div className="relative inline-flex" ref={menuRef}>
                <button
                  className="inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0 transition-transform duration-120 ease-in-out hover:scale-[1.04]"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <Avatar
                    name={displayName}
                    size={36}
                    className="max-[480px]:!h-10.5 max-[480px]:!w-10.5"
                  />
                </button>

                {menuOpen && (
                  <div
                    className="absolute top-[calc(100%+10px)] right-0 z-60 min-w-58 origin-top-right animate-[web-sheet-in_140ms_cubic-bezier(0.16,1,0.3,1)_both] rounded-(--r-md) border border-(--line) bg-(--card) p-2 shadow-(--sh-lg)"
                    role="menu"
                  >
                    <div className="flex items-center gap-2.75 px-2.5 pt-2 pb-3">
                      <Avatar name={displayName} size={36} />
                      <div>
                        <div className="text-[14.5px] font-bold text-(--ink)">
                          {displayName}
                        </div>
                        {user.email && (
                          <div className="mt-px text-[12.5px] text-(--ink-faint)">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mx-1 my-1.5 hidden h-px bg-(--line) max-[480px]:block" />
                    <Link
                      to="/events"
                      className={`${MENU_ITEM} hidden max-[480px]:flex`}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      <Trans>My events</Trans>
                    </Link>
                    <div className="mx-1 my-1.5 h-px bg-(--line)" />
                    <button
                      className={MENU_ITEM}
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      <Trans>Sign out</Trans>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Button asChild>
              <Link to="/login" search={{ redirect: "", mode: "signin" }}>
                <Trans>Log in</Trans>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
