# C05 hosted-check history

These are actual C05 checks, separate from reused T25 application acceptance.
They do not change the conservative `partly works` Story statuses.

At initial dossier head `8d3a4a1dbd7c582cd5aa5bf4e495fa3e8e9c6e11`:

- The [branch push CI](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39129692266)
  passed Python, Node build/tests and secret scanning.
- The [first PR Node job](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39129850850/job/117682618509)
  passed install/lint, then reported **235 passed, 1 failed**. The failure was
  `movie-detail-rating.test.tsx:75`, test `public content stays visible while
  session checking waits without private reads`: expected two fetch calls,
  observed one. The production/test file is unchanged from the T25 manifest.
  The assertion follows a public-content render while a child session-check
  effect is asynchronous; this suggests a timing assumption, not a proved
  root cause or a product-auth fix.
- Local targeted replay `npm --prefix frontend test -- src/tests/movie-detail-rating.test.tsx`
  on the same dossier head passed all **5 tests** on 2026-10-18, macOS,
  Node v24.21.0. This does not erase the hosted failure.
- The [actual Node rerun](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39129850850/job/117683653339)
  passed on the same head; Python and secret checks also passed. The first
  failure remains recorded above; the underlying timing cause is not proved
  fixed. The final documentation head still needs its own hosted checks.

At that recorded stage, the PR was a draft requiring a real substantive non-contributor review,
approval, completion of missing human assets/evidence and a later merge.
The initial PR description used a reference rather than a closing instruction because
#136 still includes final export/LMS requirements. An initial negated closing
phrase was removed after discovering that the linkage workflow matched it.
A green linkage check from that initial text is not issue-completion evidence;
no automatic closure is intended.

After removing the ambiguous closing phrase, [issue-linkage](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39130046056/job/117683175815)
and [independent-review](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39130046056/job/117683175713)
checks fail for the stated workflow reasons. The reviewability check passes.
Do not manufacture issue completion or teammate approval to satisfy these gates.

## Follow-up after C03 merge

The PO authorized child Task #189, whose scope ends at reviewed draft/source/
tooling merge. The follow-up PR description can close #189 and reference #136;
the parent still includes final merged export and LMS/receipt requirements.
This corrects linkage without relaxing the workflow or prematurely closing
the parent. It does not supply a teammate approval. The follow-up candidate
must receive its own hosted checks and substantive non-contributor review;
the initial runs above are not relabelled as results for that candidate.

Concurrent commit `b1529d5` has already made explicit non-closing references
valid and added six actual-parser regression tests. That change and its
historical result record are retained. The authorized child Task #189 still
defines the reviewed draft/tooling milestone; parent #136 remains the final
submission obligation.
