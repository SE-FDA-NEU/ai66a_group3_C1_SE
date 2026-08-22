# Software Process Dossier

## 1. Chosen Process and Its Position on the Spectrum

### (a) The model

Our team will follow an **Incremental Development model with an Agile-oriented working rhythm and plan-driven milestone gates** for the AI Movie Recommendation System. The system recommends movies based on user ratings, preferences, and interaction history. Because recommendation quality is uncertain before testing, we will build the product through several working increments.

In each cycle, the team reviews the backlog and selects a small set of features, such as rating input, content-based recommendation, collaborative filtering, cold-start handling, or the recommendation API. Members clarify the selected requirements, then design, implement, and test features on separate Git branches. A Pull Request is reviewed by another member before approved work is merged into `main`. Each cycle ends with a tested, integrated working increment that can be demonstrated and evaluated.

### (b) Position on the plan-driven–agile spectrum

Our process is approximately **75% Agile and 25% plan-driven**. The project goal, main scope, four course milestones, and final demo date are fixed for the semester. However, feature priorities, interface details, recommendation techniques, evaluation methods, and minor requirements can be reconsidered each cycle based on testing and feedback. This provides flexibility while preserving fixed academic deadlines.

## 2. The Five Diagnostic Questions

### 1. Requirements stability

Our requirements are **relatively volatile**. The main goal—providing relevant movie recommendations—is stable, but the implementation may change after experiments. For example, collaborative filtering may perform poorly for new users with little rating history, creating a cold-start problem. Testing may therefore lead us to add content-based or hybrid methods or adjust the data used by the recommendation engine.

### 2. Safety and legal impact

The project has **low safety impact** because incorrect movie recommendations do not threaten health, physical safety, or critical financial operations. However, we must still consider user privacy, storage of ratings or interaction history, and licensing of movie datasets or external APIs. These issues require responsible data handling and basic documentation, but not heavyweight change control.

### 3. Team size and distribution

Our team is a 5 students team, so communication cost is low. Members can coordinate through direct discussion, class meetings, group messaging, GitHub issues, branches, and Pull Requests. This makes rapid clarification practical and reduces the need for extensive documentation.

### 4. Customer engagement

Customer engagement is **periodic rather than continuous**. The instructor provides guidance and feedback during course activities and milestone checkpoints. We may also ask other students to evaluate recommendation relevance and usability. Because feedback is available during the semester but not every day, incremental development is suitable for improving the product between checkpoints.

### 5. Organizational and contract constraints

The course imposes **four fixed milestones and a fixed final demo date**. These dates cannot be changed simply because the team wants another development cycle. Therefore, each milestone acts as a plan-driven gate. Inside those boundaries, the team can re-prioritize features, improve the recommendation algorithm, and adjust implementation details.

## 3. Critical Thinking: Risk of the Opposite Choice

If the team used a **fully plan-driven process**, the biggest risk would be committing too early to an unsuitable recommendation approach. If the algorithm were frozen before enough testing, the team might later discover poor performance for new users or irrelevant recommendations. Changing it could require reworking the model, API, data processing, and interface. The first visible symptom would be poor recommendation quality during testing while completed components still depend on the original design.

## 4. Process Rules Our Team Commits To

1. Every feature or bug fix must be developed on a separate Git branch; direct development on `main` is not allowed.
2. Every change to `main` must go through a Pull Request reviewed and approved by at least one other team member.
3. The backlog must be reviewed and re-prioritized at the beginning of every development cycle based on milestone requirements, testing, and feedback.
4. Any requirement change after a cycle starts must be recorded in `docs/changelog.md` with the reason for the change.
5. A feature may be merged into `main` only after implementation, basic testing, and peer review are completed.
