import { Link } from "react-router-dom";

function RecommendationExplanationPage() {
  return (
    <main className="page page--centered explanation-page">
      <article className="content-card explanation-card">
        <p className="eyebrow">AI Movie Recommendation System</p>
        <h1>About Recommendations</h1>

        <section aria-labelledby="recommendation-process-title">
          <h2 id="recommendation-process-title">How recommendations work</h2>
          <ol className="recommendation-steps">
            <li>
              <strong>Register or sign in.</strong>{" "}
              Create an account or sign in so that the system can keep your
              preferences and optional ratings with your account.
            </li>
            <li>
              <strong>Choose genres.</strong>{" "}
              Select the movie genres that you prefer.
            </li>
            <li>
              <strong>
                Receive recommendations with optional movie ratings.
              </strong>{" "}
              View recommendations based on your selected genres, and
              optionally rate movies to provide feedback for later
              recommendations.
            </li>
          </ol>
        </section>

        <section
          className="explanation-section"
          aria-labelledby="browse-without-account-title"
        >
          <h2 id="browse-without-account-title">Browse without an account</h2>
          <p>You can browse popular movies without signing in or providing preferences.</p>
        </section>

        <section
          className="explanation-section"
          aria-labelledby="tmdb-attribution-title"
        >
          <h2 id="tmdb-attribution-title">TMDb Attribution</h2>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </section>

        <Link className="button-link explanation-back-link" to="/">
          Back to Catalogue
        </Link>
      </article>
    </main>
  );
}

export default RecommendationExplanationPage;
