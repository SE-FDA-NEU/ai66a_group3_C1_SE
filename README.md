# AI Movie Recommendation System

For university students facing choice overload, this system turns a small set of
genre preferences and optional ratings into transparent movie recommendations,
rather than giving every viewer the same generic popularity list.

## Team and Sprint 1 roles

| Member           | GitHub                                                       | Sprint 1 responsibility                                   |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Nguyen Xuan Kiet | [`@kietxuan`](https://github.com/kietxuan)                   | Product Owner; C01 backlog refinement                     |
| Tran Minh Hoang  | [`@hoang3003`](https://github.com/hoang3003)                 | Scrum Master; C02 Sprint 1 wrap-up                        |
| Tran Tuan Anh    | [`@anotify-vie`](https://github.com/anotify-vie)             | C03 user research, personas, and scenarios                |
| Vu Quoc Huy      | [`@vu-huzy`](https://github.com/vu-huzy)                     | C04 M1 requirements-document integration                  |
| Nguyen Tuan Anh  | [`@NguyenTuanAnh0608`](https://github.com/NguyenTuanAnh0608) | C05 repository readiness, rules, routes, and traceability |

## Project management

- Repository: [SE-FDA-NEU/ai66a_group3_C1_SE](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE)
- Project board: [@group3_c1_se — Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9)
- Product backlog: 14 Story Issues, #17–#24, #30–#33, #44 and #45 (54 points).
  The six P0 Stories are S01–S04, S12 and S13; S06 is P1.

## Requirements references

- [Product scope](docs/product-scope.md)
- [Business rules with worked examples](docs/business-rules.md)
- [Route and Story traceability](docs/traceability.md)
- [M2 architecture and ownership contract](docs/architecture.md)
- [M2 auth, catalogue, and recommendation API contract](docs/api.md)
- [Definition of Done](docs/definition-of-done.md)
- [Sprint log](docs/sprint-log.md)

## Definition of Done

A Story is Done only when every acceptance criterion passes, the feature runs from
a clean clone using this README, an automated test covers the changed behaviour, CI
is green, a teammate who did not author the change approves the PR, the PR is merged
to `main`, no secret or database dump is committed, and traceability is updated when
a route or screen changes. The full checklist is in
[docs/definition-of-done.md](docs/definition-of-done.md).

## Setup

The C03 architecture contract selects the intended Sprint 2 stack and command
interface in [docs/architecture.md](docs/architecture.md). At the current base
commit, the repository still contains requirements and delivery-process
scaffolding only: no application manifest, source directory, migration, or
verified runtime command exists. S2-C04 (#70) must create and independently
verify those runtime outputs before this section can present them as working.

```bash
git clone https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
cd ai66a_group3_C1_SE
```

When S2-C04 is implemented and reviewed, this section will contain the observed
install, data-initialisation, run, and test commands required for a clean clone.
