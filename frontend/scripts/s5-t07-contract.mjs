import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const COUNTRIES = { US: "United States", GB: "United Kingdom", SG: "Singapore" };
export const GROUPS = ["flatrate", "rent", "buy", "free", "ads"];

export async function sourceHead(root) {
  const directory = path.join(root, "backend/alembic/versions");
  const revisions = new Set();
  const parents = new Set();
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".py")) continue;
    const content = await readFile(path.join(directory, file), "utf8");
    const revision = content.match(/^revision(?:\s*:[^=\n]+)?\s*=\s*["']([^"']+)["']/m)?.[1];
    const parent = content.match(/^down_revision(?:\s*:[^=\n]+)?\s*=\s*["']([^"']+)["']/m)?.[1];
    assert(revision, "Cannot read an Alembic revision; inspect the source before acceptance");
    revisions.add(revision);
    if (parent) parents.add(parent);
  }
  const heads = [...revisions].filter(revision => !parents.has(revision));
  assert.equal(heads.length, 1, "Acceptance requires exactly one source migration head");
  return heads[0];
}

export function assertHealth(observation, expectedHead) {
  assert.equal(observation.status, 200, "Health must return HTTP 200");
  assert.equal(observation.body?.status, "ok", "Health must confirm the application");
  assert.equal(observation.body?.database, "connected", "Health must confirm the database");
  assert.equal(observation.body?.migrationVersion, expectedHead, "Public schema differs from this source candidate");
}

export function assertWatchUrl(value, country, sourceId) {
  if (value === null) return;
  assert.equal(typeof value, "string", "Watch-options URL must be a string or null");
  assert(![...value].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127), "Watch-options URL contains whitespace/control characters");
  assert(/^[1-9]\d*$/.test(String(sourceId ?? "")), "A trusted movie/source-ID mapping is required to check a non-null link");
  const url = new URL(value);
  assert(["https://www.themoviedb.org", "https://themoviedb.org"].includes(url.origin), "Unexpected watch-options origin");
  assert.equal(url.username + url.password + url.hash, "", "Watch-options URL contains unexpected components");
  assert(new RegExp(`^/movie/${sourceId}(?:-[A-Za-z0-9-]+)?/watch$`).test(url.pathname), "Watch-options link belongs to another movie");
  assert.equal(url.search, `?locale=${country}`, "Watch-options link belongs to another market");
}

export function assertRegional(observation, movieId, country, sourceId) {
  assert.equal(observation.status, 200, "Regional Details must return HTTP 200");
  const movie = observation.body?.data?.movie;
  assert.equal(movie?.id, movieId, "Details returned another movie");
  assert.equal(movie.providers?.country, country, "Details returned another country");
  assert(["success", "no_data", "stale", "error", "not_checked"].includes(movie.providers?.status), "Unknown provider status");
  assert(Object.hasOwn(movie, "watchOptionsUrl"), "Missing nullable watch-options contract");
  assertWatchUrl(movie.watchOptionsUrl, country, sourceId);
  for (const group of GROUPS) {
    assert(Array.isArray(movie.providers.groups?.[group]), `Missing ${group} group`);
    if (!["success", "stale"].includes(movie.providers.status)) {
      assert.equal(movie.providers.groups[group].length, 0, "Unavailable status must not expose successful memberships");
    }
  }
  return movie;
}

export function assertProviderUi(observation, movie, country, sourceId) {
  assert.equal(observation.countrySelector, 1, "Country selector must be visible");
  assert.equal(observation.selectedCountry, country, "Selector does not match the requested market");
  assert.equal(observation.heading, `Where to watch in ${COUNTRIES[country]}`, "Wrong market heading");
  assert.equal(observation.actionHref, movie.watchOptionsUrl, "UI and API watch-options URLs differ");
  assert.equal(observation.actionCount, movie.watchOptionsUrl === null ? 0 : 1, "Unexpected number of watch-options actions");
  if (movie.watchOptionsUrl !== null) {
    assertWatchUrl(observation.actionHref, country, sourceId);
    assert.equal(observation.actionTarget, "_blank", "Watch options must open a new tab");
    const rel = new Set((observation.actionRel ?? "").split(/\s+/));
    assert(rel.has("noopener") && rel.has("noreferrer"), "External action is missing safe rel values");
  }
  for (const group of GROUPS) {
    assert.deepEqual(observation.groups[group], movie.providers.groups[group].map(provider => provider.name), "Displayed provider groups differ from the selected movie/country");
  }
  assert(observation.attribution, "TMDb/JustWatch attribution must be visible");
  assert(observation.staleWarning === (movie.providers.status === "stale"), "Stale warning does not match provider freshness");
}
