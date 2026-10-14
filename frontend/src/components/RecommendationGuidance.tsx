import { Link } from "react-router-dom";

type RecommendationGuidanceProps = {
  variant: "cold-start" | "empty" | "no-match";
  hasAlternatives?: boolean;
  onRetry?: () => void;
};

function RecommendationGuidance({
  variant,
  hasAlternatives = false,
  onRetry,
}: RecommendationGuidanceProps) {
  if (variant === "cold-start") {
    return (
      <div className="recommendation-empty-state" role="status">
        <h3>Recommendations based on popular movies</h3>
        <p>
          Add your favourite genres to get personalised recommendations.
        </p>
        <Link className="text-link" to="/preferences">
          Enter preferences &rarr;
        </Link>
      </div>
    );
  }

  if (variant === "no-match") {
    return (
      <div className="recommendation-empty-state" role="status">
        <h3>No movies matched your favourite genres.</h3>
        <p>
          {hasAlternatives
            ? "Try these popular alternatives, edit your preferences, or retry."
            : "Edit your preferences or retry to look for recommendations again."}
        </p>

        <div className="recommendation-actions">
          <Link className="text-link" to="/preferences">
            Edit preferences
          </Link>

          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="recommendation-empty-state" role="status">
      <h3>No recommendations available yet.</h3>
      <p>No movies are currently available for this recommendation list.</p>
      <Link className="text-link" to="/preferences">
        Enter preferences &rarr;
      </Link>
    </div>
  );
}

export default RecommendationGuidance;