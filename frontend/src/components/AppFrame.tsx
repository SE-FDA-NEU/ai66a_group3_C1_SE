import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ThemeToggle } from "../theme.tsx";
import SessionNavigation from "./SessionNavigation.tsx";
import { useAuth } from "../auth/authState.ts";

export default function AppFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const auth = useAuth();
  const authPage = pathname === "/login" || pathname === "/register";
  // Public lists restore sessions as before. Other routes keep their existing
  // guard/rating ownership; the static explanation must not start an API call.
  const publicList = pathname === "/" || pathname === "/popular";
  const showSession = !authPage && (publicList || auth.status === "authenticated" || auth.status === "unauthenticated");
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="brand" to="/" aria-label="CineAI movie catalogue">
          <span className="brand__mark" aria-hidden="true">✦</span><span>Cine<span className="brand__accent">AI</span></span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/popular">Popular movies</NavLink>
          <NavLink to="/preferences">Preferences</NavLink>
          <NavLink to="/about-recommendations">How recommendations work</NavLink>
        </nav>
        <div className="app-header__account">
          <ThemeToggle />
          {showSession ? <SessionNavigation currentPage={pathname === "/recommendations" ? "recommendations" : undefined} /> : null}
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
