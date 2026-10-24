import type { ReactNode } from "react";

export default function AuthLayout({ mode, children }: {
  mode: "sign-in" | "register"; children: ReactNode;
}) {
  return <main className={`page auth-page auth-page--${mode}`}>
    <div className="auth-layout">
      <aside className="auth-art" aria-label="CineAI movie discovery">
        <div className="auth-art__brand"><span aria-hidden="true">✦</span> CineAI</div>
        <div className="cinema-orbit" aria-hidden="true">
          <div className="cinema-orbit__ring" /><div className="cinema-orbit__ring" />
          <div className="cinema-orbit__frame"><span>01</span><i /><span>DISCOVER</span></div>
          <div className="cinema-orbit__frame"><span>02</span><i /><span>YOUR TASTE</span></div>
          <div className="cinema-orbit__frame"><span>03</span><i /><span>NEXT WATCH</span></div>
        </div>
        <div className="auth-art__copy">
          <p className="eyebrow">A little more you</p>
          <p className="auth-art__headline">{mode === "sign-in" ? <>Your next<br /><em>favourite film.</em></> : <>Good films.<br /><em>Your kind of films.</em></>}</p>
          <p>Save your taste. Find your next watch.</p>
        </div>
        <p className="auth-art__footnote"><span aria-hidden="true">✦</span> Genres · Ratings · Recommendations</p>
      </aside>
      <section className="auth-card" aria-labelledby={mode === "sign-in" ? "login-title" : "register-title"}>
        {children}
      </section>
    </div>
  </main>;
}
