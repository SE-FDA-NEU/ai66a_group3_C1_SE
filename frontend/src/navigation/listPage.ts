import type { CatalogueSort, PageMeta } from "../api/movies.ts";

export const MAX_GENRE_ID = 2147483647;

export function readCatalogueSort(search: string): CatalogueSort {
  return new URLSearchParams(search).get("sort") === "title_desc" ? "title_desc" : "title_asc";
}

export function readGenreId(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("genreId");
  if (!raw || !/^[1-9]\d*$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= MAX_GENRE_ID ? value : undefined;
}

export function readPage(search: string): number {
  const raw = new URLSearchParams(search).get("page");
  if (raw === null) return 1;
  if (!/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page <= 10000 ? page : 1;
}

export function pageSearch(search: string, page: number): string {
  const params = new URLSearchParams(search);
  params.set("page", String(page));
  return `?${params}`;
}

export function resultSummary(meta: PageMeta, filtered = false): string {
  if (meta.total === 0) return filtered ?
    `Showing 0 matches (${meta.unfilteredTotal} recommendations before filtering)` :
    "Showing 0 movies";
  const start = (meta.page - 1) * meta.limit + 1;
  const end = start + meta.count - 1;
  return filtered ?
    `Showing ${start}-${end} of ${meta.total} matches (${meta.unfilteredTotal} recommendations before filtering)` :
    `Showing ${start}-${end} of ${meta.total} movies`;
}
