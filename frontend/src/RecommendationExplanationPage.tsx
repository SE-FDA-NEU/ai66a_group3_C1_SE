function RecommendationExplanationPage() {
  return (
    <main>
      <h1>How recommendations work</h1>

      <ol>
        <li>
          <strong>Register or sign in.</strong> Create an account or sign in so
          that the system can keep your preferences and optional ratings with
          your account.
        </li>
        <li>
          <strong>Choose genres.</strong> Select the movie genres that you
          prefer.
        </li>
        <li>
          <strong>Receive recommendations with optional movie ratings.</strong>{" "}
          View recommendations based on your selected genres, and optionally
          rate movies to provide feedback for later recommendations.
        </li>
      </ol>

      <section aria-labelledby="browse-without-account">
        <h2 id="browse-without-account">Browse without an account</h2>
        <p>
          You can browse popular movies without signing in or providing
          preferences.
        </p>
      </section>

      <section aria-labelledby="tmdb-attribution">
        <h2 id="tmdb-attribution">TMDb attribution</h2>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      </section>
    </main>
  );
}

export default RecommendationExplanationPage;