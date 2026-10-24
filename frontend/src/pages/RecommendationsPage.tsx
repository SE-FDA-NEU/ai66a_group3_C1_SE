import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getRecommendationPage, RecommendationApiError,
  type RecommendationResult } from "../api/recommendations.ts";
import type { PageMeta } from "../api/movies.ts";
import { useAuth } from "../auth/authState.ts";
import RecommendationFilter from "../components/RecommendationFilter.tsx";
import RecommendationGuidance from "../components/RecommendationGuidance.tsx";
import { currentReturnPath } from "../navigation/movieDetailReturn.ts";
import { pageSearch, readGenreId, readPage } from "../navigation/listPage.ts";
import { listViewState, readListViewState, sameListViewContext,
  type ListViewContext } from "../navigation/listViewState.ts";

export function RecommendationState({ status }: { status: "loading" | "empty" }) {
  if (status === "loading") return <p role="status">Loading recommendations...</p>;
  return <div className="recommendation-empty-state" role="status">
    <h3>No recommendations available yet.</h3>
    <p>Enter your preferences to get personalised recommendations.</p>
    <Link className="text-link" to="/preferences">Enter preferences &rarr;</Link>
  </div>;
}

type Load = { key: string } & (
  | { status: "ready"; result: RecommendationResult; meta: PageMeta }
  | { status: "error"; message: string; code?: string }
);

export default function RecommendationsPage() {
  const location = useLocation();
  const latestLocation = useRef(location);
  const navigate = useNavigate();
  const auth = useAuth();
  const { handleUnauthorized, recommendationScope, recommendationVersion } = auth;
  const page = readPage(location.search);
  const rawGenre = new URLSearchParams(location.search).get("genreId");
  const genreId = readGenreId(location.search);
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const storedContext = readListViewState(location.state, "/recommendations");
  const [lastContext, setLastContext] = useState<ListViewContext | null>(storedContext);
  const activeContext = storedContext ?? lastContext;
  const hasStoredContext = activeContext !== null;
  const staleContext = activeContext !== null &&
    (activeContext.accountId !== userId ||
      activeContext.recommendationScope !== recommendationScope);
  const revision = useRef<string | undefined>(
    staleContext ? undefined : activeContext?.catalogueRevision);
  const key = `${userId}:${recommendationScope}:${recommendationVersion}:${page}:${genreId ?? ""}:${retry}`;
  const current = load?.key === key ? load : null;

  useLayoutEffect(() => { latestLocation.current = location; }, [location]);

  const context = useCallback((catalogueRevision?: string): ListViewContext => {
    return { route: "/recommendations", accountId: userId ?? "",
      recommendationScope, catalogueRevision };
  }, [userId, recommendationScope]);

  useEffect(() => {
    if (staleContext) return;
    const params = new URLSearchParams(location.search);
    const rawPage = params.get("page");
    if (rawPage !== null && rawPage !== String(page)) params.set("page", String(page));
    if (rawGenre !== null && genreId === undefined) params.delete("genreId");
    if (params.toString() !== location.search.replace(/^\?/, "")) {
      navigate({ pathname: location.pathname, search: `?${params}` },
        { replace: true, state: listViewState(context(revision.current)) });
    }
  }, [location.pathname, location.search, navigate, page, rawGenre, genreId,
    staleContext, context]);

  useLayoutEffect(() => {
    if (!userId) return;
    if (staleContext) {
      revision.current = undefined;
      navigate("/recommendations?page=1", { replace: true,
        state: listViewState(context(undefined)) });
      return;
    }
    if (!storedContext) {
      const stampedContext = activeContext ?? context(revision.current);
      if (!activeContext) setLastContext(stampedContext);
      navigate({ pathname: location.pathname, search: location.search,
        hash: location.hash }, { replace: true,
          state: listViewState(stampedContext) });
    }
  }, [userId, staleContext, storedContext, activeContext, context, navigate,
    location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!userId || staleContext || !hasStoredContext) return;
    const controller = new AbortController();
    const requestedRevision = activeContext?.catalogueRevision ?? revision.current;
    getRecommendationPage(page, genreId, requestedRevision, controller.signal).then(body => {
      if (controller.signal.aborted) return;
      const currentLocation = latestLocation.current;
      if (currentLocation.pathname !== "/recommendations" ||
        readPage(currentLocation.search) !== page || readGenreId(currentLocation.search) !== genreId) return;
      revision.current = body.meta.catalogueRevision;
      const acceptedContext = context(body.meta.catalogueRevision);
      setLastContext(acceptedContext);
      if (page > body.meta.totalPages && page !== 1) {
        navigate({ pathname: currentLocation.pathname, search: pageSearch(currentLocation.search,
          Math.max(1, body.meta.totalPages)), hash: currentLocation.hash },
          { replace: true, state: listViewState(acceptedContext) });
        return;
      }
      if (!sameListViewContext(readListViewState(currentLocation.state, "/recommendations"),
        acceptedContext)) {
        navigate({ pathname: currentLocation.pathname, search: currentLocation.search,
          hash: currentLocation.hash }, { replace: true,
          state: listViewState(acceptedContext) });
      }
      setLoad({ key, status: "ready", result: body.data, meta: body.meta });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const currentLocation = latestLocation.current;
      if (currentLocation.pathname !== "/recommendations" ||
        readPage(currentLocation.search) !== page || readGenreId(currentLocation.search) !== genreId) return;
      if (error instanceof RecommendationApiError && error.status === 401) {
        handleUnauthorized(); return;
      }
      if (error instanceof RecommendationApiError && error.code === "CATALOGUE_CHANGED") {
        revision.current = undefined;
        navigate({ pathname: currentLocation.pathname,
          search: pageSearch(currentLocation.search, 1), hash: currentLocation.hash },
          { replace: true, state: listViewState(context(undefined)) });
        if (page === 1) setRetry(value => value + 1);
        return;
      }
      setLoad({ key, status: "error", message: error instanceof Error ? error.message : "Something went wrong",
        code: error instanceof RecommendationApiError ? error.code : undefined });
    });
    return () => controller.abort();
    // Only page, genre, account, revision conflict or retry changes the result.
    // Source/hash navigation and a successful context stamp must not repeat the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, recommendationScope, recommendationVersion, staleContext, hasStoredContext,
    handleUnauthorized, page, genreId, retry, key, navigate,
    location.pathname, context]);

  function changeGenre(next?: number) {
    const params = new URLSearchParams(location.search);
    params.set("page", "1");
    if (next === undefined) params.delete("genreId");
    else params.set("genreId", String(next));
    navigate({ pathname: location.pathname, search: `?${params}` },
      { state: listViewState(context(revision.current)) });
  }

  const result = current?.status === "ready" ? current.result : null;
  const meta = current?.status === "ready" ? current.meta : null;
  const title = result?.noMatch ? "Popular alternatives" :
    result?.personalised ? "Recommended for you" : result ? "Popular" : "Your recommendations";

  return <main className="page">
    <header className="topbar">
      <div><p className="eyebrow">AI Movie Recommendation System</p><h1>Recommendations</h1></div>
    </header>
    <nav className="page-nav" aria-label="Recommendation navigation">
      <Link className="text-link" to="/preferences">Change my genres</Link>
      <Link className="text-link" to="/">Browse the catalogue</Link>
    </nav>
    <section className="content-card recommendations-card" aria-labelledby="recommendations-title">
      <div className="section-heading"><p className="eyebrow">Your next watch</p>
        <h2 id="recommendations-title">{title}</h2>
        {result?.mode === "popular" ? <p className="muted recommendation-mode">Not personalised</p> : null}
      </div>
      {!current ? <RecommendationState status="loading" /> : current.status === "error" ?
        <div className="recommendation-empty-state" role="alert">
          <h3 id="recommendation-error-title">Recommendations are unavailable</h3>
          <p id="recommendation-error-message">{current.message} {current.code === "GENRE_NOT_FOUND" ?
            "Clear filter to show all recommendations." :
            "Choose Retry to load your recommendations again."}</p>
          <button type="button" onClick={() => setRetry(value => value + 1)}
            aria-describedby="recommendation-error-title recommendation-error-message">Retry</button>
          {current.code === "GENRE_NOT_FOUND" && genreId !== undefined ?
            <button type="button" onClick={() => changeGenre(undefined)}>Clear filter</button> : null}
        </div> : <>
          {result?.noMatch ? <RecommendationGuidance variant="no-match"
            hasAlternatives={(meta?.unfilteredTotal ?? 0) > 0}
            onRetry={() => setRetry(value => value + 1)} /> : null}
          {result && !result.personalised && !result.noMatch && meta && meta.unfilteredTotal > 0 ?
            <RecommendationGuidance variant="cold-start" /> : null}
          {result && meta && meta.unfilteredTotal === 0 && !result.noMatch ?
            <RecommendationState status="empty" /> : null}
          {result && meta && (meta.unfilteredTotal > 0 || genreId !== undefined) ?
            <RecommendationFilter snapshot={result} meta={meta} genreId={genreId}
              onGenreChange={changeGenre} ariaLabel={title}
              returnTo={currentReturnPath(location)}
              returnContext={context(meta.catalogueRevision)}
              navigationState={listViewState(context(meta.catalogueRevision))} /> : null}
        </>}
    </section>
  </main>;
}
