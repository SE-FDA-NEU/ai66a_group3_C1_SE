const BACKDROP_PATH = /^\/t\/p\/w780\/[A-Za-z0-9_-]{1,128}\.(?:jpg|jpeg|png|webp)$/;

export function allowedBackdropUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.origin !== "https://image.tmdb.org" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !BACKDROP_PATH.test(url.pathname) ||
      url.href !== value
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}
