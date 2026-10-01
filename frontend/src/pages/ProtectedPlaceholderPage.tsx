function ProtectedPlaceholderPage({ title }: { title: string }) {
  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Movie Recommendation System</p>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="content-card">
        <p className="muted">This page will be connected when its API is available.</p>
      </section>
    </main>
  );
}

export default ProtectedPlaceholderPage;
