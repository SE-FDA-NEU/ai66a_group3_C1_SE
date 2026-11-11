import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ThemeToggle } from "../theme.tsx";
import SessionNavigation from "./SessionNavigation.tsx";
import { useAuth } from "../auth/authState.ts";
import MobileNavigation from "./MobileNavigation.tsx";

const compactQuery = "(max-width: 1100px)";
function subscribeCompact(onChange: () => void) {
  const media = window.matchMedia?.(compactQuery);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
const isCompact = () => window.matchMedia?.(compactQuery).matches ?? false;

export default function AppFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const auth = useAuth();
  const compact = useSyncExternalStore(subscribeCompact, isCompact, () => false);
  const authPage = pathname === "/login" || pathname === "/register";
  // Public lists restore sessions as before. Other routes keep their existing
  // guard/rating ownership; the static explanation must not start an API call.
  const publicList = pathname === "/" || pathname === "/popular" || pathname === "/search";
  const showSession = !authPage && (publicList || auth.status === "authenticated" || auth.status === "unauthenticated");
  const { status, refresh } = auth;
  useEffect(() => {
    // A closed mobile drawer must not prevent public pages restoring a session.
    if (publicList && status === "unknown") void refresh();
  }, [publicList, status, refresh]);
  const navigation = <nav className="primary-nav" aria-label="Main navigation">
    <NavLink to="/" end>Home</NavLink>
    <NavLink to="/popular">Popular movies</NavLink>
    <NavLink to="/search">Search</NavLink>
    <NavLink to="/recommendations">My recommendations</NavLink>
    <NavLink to="/preferences">Preferences</NavLink>
    <NavLink to="/watchlist">My watchlist</NavLink>
    {auth.status === "authenticated" ? <NavLink to="/profile">Profile</NavLink> : null}
    <NavLink to="/about-recommendations">How recommendations work</NavLink>
  </nav>;
  const session = showSession ? <SessionNavigation showRecommendationsLink={false} /> : null;
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="brand" to="/" aria-label="CineAI movie catalogue">
          <span className="brand__mark" aria-hidden="true">✦</span><span>Cine<span className="brand__accent">AI</span></span>
        </Link>
        {!compact ? navigation : null}
        <div className="app-header__account">
          <ThemeToggle />
          {compact ? <MobileNavigation>{navigation}{session}</MobileNavigation> : session}
        </div>
      </div>
    </header>
    <div id="main-content" className="app-content" tabIndex={-1}>{children}</div>
    <footer className="app-footer">
      <span className="brand">Cine<span className="brand__accent">AI</span></span>
      <p>Less scrolling. More discovering.</p>
      <p>Movie metadata and artwork: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDb</a>.</p>
      <Link to="/about-recommendations">About this project</Link>
    </footer>
  </>;
}
