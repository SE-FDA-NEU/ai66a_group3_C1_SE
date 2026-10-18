// Read-only, dependency-free structural checks for the C01 documentation bundle.
// This is not private-Project verification or independent human acceptance.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = file => readFileSync(path.join(root, file), "utf8");
const snapshot = JSON.parse(read("docs/evidence/s3-c01-backlog/snapshot.json"));
const updates = JSON.parse(read("docs/evidence/s3-c01-backlog/issue-updates.json"));
const finalAudit = JSON.parse(read("docs/evidence/s3-c01-backlog/final-issue-audit.json"));
const doc = read("docs/sprint3-backlog-refinement.md");
const readme = read("README.md");
const checks = [];
const check = name => checks.push(name);

assert.equal(snapshot.sprintDates.start, "2026-10-05");
assert.equal(snapshot.sprintDates.end, "2026-10-18");
assert(readme.includes("05–18 October 2026"));
const start = readme.indexOf("## Sprint 3 review — start here");
const team = readme.indexOf("## Team and Sprint 1 roles");
assert(start > 0 && team > start, "P0 review block must precede historical roles");
const entryBlock = readme.slice(start, team);
for (const n of [17, 18, 19, 20, 44, 45]) assert(entryBlock.includes(`/issues/${n}`));
for (const item of ["@kietxuan", "@vu-huzy", "@hoang3003", "@NguyenTuanAnh0608", "Select at least one genre (up to 5), then choose Save preferences."]) assert(entryBlock.includes(item));
check("README lists all six P0 entry points, current dates, roles and BR1 rejection before historical roles");

const ids = snapshot.inventory.map(w => w.issue);
assert.equal(ids.length, 43);
assert.equal(new Set(ids).size, 43);
for (const [kind, count] of [["Task", 37], ["Chore", 5], ["Spike", 1]]) assert.equal(snapshot.inventory.filter(w => w.kind === kind).length, count);
assert.equal(snapshot.inventory.filter(w => w.state === "closed").length, snapshot.counts.closed);
assert.equal(snapshot.inventory.filter(w => w.state === "open").length, snapshot.counts.open);
assert.equal(snapshot.counts.closed + snapshot.counts.open, 43);
for (const w of snapshot.inventory) {
  assert.equal(w.assignees.length, 1, `Missing actual owner #${w.issue}`);
  assert(w.reviewer, `Missing reviewer/requested reviewer #${w.issue}`);
  assert(doc.includes(`/issues/${w.issue}`), `Issue absent from report #${w.issue}`);
  assert.equal(w.originalPlannedDay, null, "Do not manufacture historical target days");
}
check("43 unique work items, owner/reviewer fields and actual open/closed totals are consistent");

const visiting = new Set(), visited = new Set();
function visit(n) {
  if (!ids.includes(n) || visited.has(n)) return;
  assert(!visiting.has(n), `Hard-dependency cycle at #${n}; distinguish Chore milestones`);
  visiting.add(n);
  for (const dep of snapshot.inventory.find(w => w.issue === n).hardDependencies) visit(dep);
  visiting.delete(n); visited.add(n);
}
for (const n of ids) visit(n);
assert(snapshot.inventory.find(w => w.issue === 110).hardDependencies.includes(104));
assert(snapshot.inventory.find(w => w.issue === 110).hardDependencies.includes(109));
assert(snapshot.inventory.find(w => w.issue === 131).hardDependencies.includes(179));
assert(!snapshot.inventory.find(w => w.issue === 179).hardDependencies.includes(131));
check("Hard-dependency graph is acyclic; T08 prerequisites and backdrop UI/verifier direction are preserved");

assert.deepEqual(snapshot.storyAudit.map(s => s.issue), [17, 18, 19, 20, 44, 45]);
assert.equal(snapshot.storyAudit.reduce((sum, s) => sum + s.rows.length, 0), 27);
for (const s of snapshot.storyAudit) {
  assert.equal(s.acceptanceStatus, "partly works");
  for (const r of s.rows) {
    for (const word of ["Given", "When", "Then"]) assert(new RegExp(`\\b${word}\\b`, "i").test(r.text), `Incomplete multiline AC #${s.issue}/${r.ac}`);
    assert(r.implementationIssues.length || r.implementationBaselineFiles.length, `Missing implementation mapping #${s.issue}/${r.ac}`);
    assert.equal(r.finalHandoffIssue, 127);
    for (const file of r.implementationBaselineFiles) assert(existsSync(path.join(root, file)), `Missing implementation file ${file}`);
  }
}
assert.equal(snapshot.storyPoints.productBacklog, 54);
assert.equal(snapshot.storyPoints.p0ProductTotal, 24);
assert.equal(snapshot.storyPoints.sprint3Committed, null);
assert.equal(snapshot.storyPoints.sprint3Completed, null);
assert.equal(snapshot.storyPoints.sprint3Velocity, null);
check("All 27 complete multiline P0 AC have implementation/verification mapping; unknown sprint metrics are not fabricated");

assert.equal(new Set(snapshot.contributions.map(c => c.member)).size, 5);
for (const c of snapshot.contributions) {
  assert(c.authoredMergedPrUrl.includes(`/pull/${c.authoredMergedPr}`));
  assert(c.closedIssueUrl.includes(`/issues/${c.closedAssignedIssue}`));
  assert(c.reviewGivenUrl.includes("#pullrequestreview-"));
}
for (const image of snapshot.planningImages) {
  const bytes = readFileSync(path.join(root, image.path));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256);
}
check("Five contribution receipts and both original, unedited PNG hashes are present");

assert(updates.changes.length > 0);
for (const change of updates.changes) {
  assert.equal(change.stateBefore, change.stateAfter);
  assert.deepEqual(change.assigneesBefore, change.assigneesAfter);
  assert.equal(change.acceptanceCriteriaUnchanged, true);
}
assert.equal(finalAudit.inventory.length, 43);
for (const item of finalAudit.inventory) {
  const recorded = snapshot.inventory.find(w => w.issue === item.issue);
  assert(recorded, `Unexpected audited issue #${item.issue}`);
  assert.equal(item.state, recorded.state);
  assert.deepEqual(item.assignees, recorded.assignees);
  assert(item.ownerMatchesAssignee && item.reviewerDifferentFromOwner);
  assert.equal(item.unresolvedLocalCodes.length, 0);
}
assert.equal(finalAudit.stories.reduce((sum, s) => sum + s.criterionCount, 0), 27);
assert(finalAudit.stories.every(s => s.criteriaMatchOriginal && s.pointsUnchanged));
const pending = ["Not supplied", "Not recorded", "independent", "capacity"];
for (const word of pending) assert(doc.toLowerCase().includes(word.toLowerCase()));
check("Issue mutation receipts and final API audit preserve state/assignee/27 AC/points; no unresolved local codes or self-review metadata");

const evidence = path.join(root, "docs/evidence/s3-c01-backlog");
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const markdown = [path.join(root, "README.md"), path.join(root, "docs/sprint3-backlog-refinement.md"), ...walk(evidence).filter(p => p.endsWith(".md"))];
for (const file of markdown) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|codex:)/.test(target)) continue;
    assert(existsSync(path.resolve(path.dirname(file), target)), `Broken local link ${file}: ${target}`);
  }
}
check("Local documentation and image links resolve");
console.log(JSON.stringify({ result: "PASS", checks, limitation: "Does not prove private board membership, original capacity, final human sign-off or hosted CI" }, null, 2));
