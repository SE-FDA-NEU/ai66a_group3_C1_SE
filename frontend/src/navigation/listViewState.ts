export type ListViewContext = {
  route: "/" | "/popular" | "/recommendations" | "/watchlist";
  catalogueRevision?: string;
  accountId?: string;
  recommendationScope?: string;
};

export type ListViewState = { listViewContext: ListViewContext };

export function listViewState(context: ListViewContext): ListViewState {
  return { listViewContext: context };
}

export function readListViewState(
  state: unknown,
  route: ListViewContext["route"],
): ListViewContext | null {
  if (!isRecord(state) || !isRecord(state.listViewContext)) return null;
  const context = state.listViewContext;
  if (context.route !== route) return null;
  if (context.catalogueRevision !== undefined &&
    (typeof context.catalogueRevision !== "string" || context.catalogueRevision.length > 128))
    return null;
  if (route === "/watchlist" && typeof context.accountId !== "string") return null;
  if (route === "/recommendations" &&
    (typeof context.accountId !== "string" ||
      typeof context.recommendationScope !== "string")) return null;
  return context as ListViewContext;
}

export function sameListViewContext(a: ListViewContext | null, b: ListViewContext): boolean {
  return a?.route === b.route &&
    a.catalogueRevision === b.catalogueRevision &&
    a.accountId === b.accountId &&
    a.recommendationScope === b.recommendationScope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
