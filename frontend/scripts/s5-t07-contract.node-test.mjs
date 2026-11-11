import assert from "node:assert/strict";
import test from "node:test";
import { assertHealth, assertProviderUi, assertRegional } from "./s5-t07-contract.mjs";

const health = { status: 200, body: { status: "ok", database: "connected", migrationVersion: "current" } };
function regional() {
  return { status: 200, body: { data: { movie: {
    id: "opaque-id", watchOptionsUrl: "https://www.themoviedb.org/movie/101/watch?locale=US",
    providers: { country: "US", status: "success", groups: { flatrate: [{ name: "Service A" }], rent: [], buy: [], free: [], ads: [] } },
  } } } };
}
function view() {
  return { countrySelector: 1, selectedCountry: "US", heading: "Where to watch in United States",
    actionHref: "https://www.themoviedb.org/movie/101/watch?locale=US", actionCount: 1,
    actionTarget: "_blank", actionRel: "noopener noreferrer", attribution: true, staleWarning: false,
    groups: { flatrate: ["Service A"], rent: [], buy: [], free: [], ads: [] } };
}

test("a current health, matching regional DTO and matching UI pass", () => {
  assertHealth(health, "current");
  const movie = assertRegional(regional(), "opaque-id", "US", "101");
  assertProviderUi(view(), movie, "US", "101");
});
for (const host of ["www.themoviedb.org", "themoviedb.org"]) test(`valid numeric-ID plus slug on ${host} passes`, () => {
  const value = regional();
  value.body.data.movie.watchOptionsUrl = `https://${host}/movie/101-example-movie/watch?locale=US`;
  assertRegional(value, "opaque-id", "US", "101");
});
for (const [name, mutate] of [
  ["HTTP 503", value => { value.status = 503; }],
  ["old migration", value => { value.body.migrationVersion = "old"; }],
]) test(`health rejects ${name}`, () => {
  const value = structuredClone(health); mutate(value);
  assert.throws(() => assertHealth(value, "current"));
});
for (const [name, mutate] of [
  ["wrong HTTP status", value => { value.status = 500; }],
  ["wrong movie", value => { value.body.data.movie.id = "other"; }],
  ["wrong country", value => { value.body.data.movie.providers.country = "GB"; }],
  ["wrong TMDb movie", value => { value.body.data.movie.watchOptionsUrl = "https://www.themoviedb.org/movie/999/watch?locale=US"; }],
  ["wrong TMDb country", value => { value.body.data.movie.watchOptionsUrl = "https://www.themoviedb.org/movie/101/watch?locale=GB"; }],
  ["unsafe URL", value => { value.body.data.movie.watchOptionsUrl = "javascript:alert(1)"; }],
]) test(`regional acceptance rejects ${name}`, () => {
  const value = regional(); mutate(value);
  assert.throws(() => assertRegional(value, "opaque-id", "US", "101"));
});
for (const [name, mutate] of [
  ["missing selector", value => { value.countrySelector = 0; }],
  ["wrong selection", value => { value.selectedCountry = "GB"; }],
  ["wrong displayed providers", value => { value.groups.flatrate = ["Wrong service"]; }],
  ["same-tab action", value => { value.actionTarget = "_self"; }],
  ["missing rel", value => { value.actionRel = ""; }],
  ["missing stale warning", value => { value.staleWarning = false; }],
]) test(`UI acceptance rejects ${name}`, () => {
  const movie = regional().body.data.movie;
  if (name === "missing stale warning") movie.providers.status = "stale";
  const value = view(); mutate(value);
  assert.throws(() => assertProviderUi(value, movie, "US", "101"));
});
test("neutral no-data with null link is valid; an extra UI link is refused", () => {
  const value = regional(); const movie = value.body.data.movie;
  movie.providers.status = "no_data"; movie.providers.groups.flatrate = []; movie.watchOptionsUrl = null;
  assertRegional(value, "opaque-id", "US", "101");
  const ui = view(); ui.actionHref = null; ui.actionCount = 0; ui.groups.flatrate = [];
  assertProviderUi(ui, movie, "US", "101");
  ui.actionCount = 1;
  assert.throws(() => assertProviderUi(ui, movie, "US", "101"));
});
