import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Execute the real inline Actions code, not a second copy of its parsing logic.
const workflow = readFileSync(new URL('../.github/workflows/scrum-check.yml', import.meta.url), 'utf8');
const linkageJob = workflow.split('  linkage:')[1].split('  no_self_merge:')[0];
const match = linkageJob.match(/          script: \|\n((?:^ {12}.*\n|^\n)*)/m);
assert(match, 'The issue-reference step must contain an inline script');
const script = match[1].replace(/^ {12}/gm, '');
const run = new (Object.getPrototypeOf(async function () {}).constructor)('context', 'core', script);

async function references(body, title = '') {
  const result = { issues: [], failure: null };
  await run({ payload: { pull_request: { body, title } } }, {
    setOutput: (name, value) => { assert.equal(name, 'issues'); result.issues = JSON.parse(value); },
    setFailed: message => { result.failure = message; },
    info: () => {},
  });
  return result;
}

test('partial dossier delivery links Refs #136 without requiring issue closure', async () => {
  assert.deepEqual(await references('Refs #136; consumes #127 and #135.'), { issues: [136], failure: null });
});
test('completed delivery still accepts closing directives', async () => {
  for (const directive of ['Closes', 'Fixes', 'Resolves']) {
    assert.deepEqual(await references(`${directive} #136`), { issues: [136], failure: null });
  }
});
test('planned issue title is a valid link and is deduplicated against the body', async () => {
  assert.deepEqual(await references('', '[#136] Package dossier'), { issues: [136], failure: null });
  assert.deepEqual(await references('Refs #136', '[#136] Package dossier'), { issues: [136], failure: null });
});
test('negated closing prose and incidental dependency mentions do not claim linkage', async () => {
  for (const body of ['This draft does not close #136.', 'Depends on #127 and #135.']) {
    const result = await references(body);
    assert.deepEqual(result.issues, []);
    assert.match(result.failure, /not linked/);
  }
});
test('each explicit issue directive is forwarded once for GitHub existence checks', async () => {
  assert.deepEqual(await references('Refs #136\n- Refs #134\nRefs #136'), { issues: [136, 134], failure: null });
});
test('missing metadata fails instead of silently passing', async () => {
  assert.match((await references(null, null)).failure, /not linked/);
});
