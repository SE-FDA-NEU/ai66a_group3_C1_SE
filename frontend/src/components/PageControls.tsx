import { useLocation, useNavigate } from "react-router-dom";
import type { PageMeta } from "../api/movies.ts";
import type { ListViewState } from "../navigation/listViewState.ts";
import { pageSearch } from "../navigation/listPage.ts";

export default function PageControls({ meta, state }: { meta: PageMeta; state?: ListViewState }) {
  const location = useLocation();
  const navigate = useNavigate();
  if (meta.totalPages <= 1) return null;
  const start = Math.max(1, Math.min(meta.page - 2, meta.totalPages - 4));
  const end = Math.min(meta.totalPages, start + 4);
  const go = (page: number) => navigate({ pathname: location.pathname,
    search: pageSearch(location.search, page) }, { state });
  return <nav className="page-controls" aria-label="Movie pages">
    <button type="button" disabled={meta.page <= 1} onClick={() => go(meta.page - 1)}>Previous</button>
    {Array.from({ length: end - start + 1 }, (_, index) => start + index).map(page =>
      <button key={page} type="button" aria-current={page === meta.page ? "page" : undefined}
        onClick={() => go(page)} disabled={page === meta.page}>{page}</button>)}
    <button type="button" disabled={meta.page >= meta.totalPages} onClick={() => go(meta.page + 1)}>Next</button>
  </nav>;
}
