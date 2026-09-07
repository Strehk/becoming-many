# Refactor Workflow

Implement the smallest clear solution at the existing owner. The binding
[target architecture](target-architecture.md) defines responsibilities and
removals; explicitly open decisions remain open.

## Authority and scope

This workflow owns execution; the [test plan](refactor-test-plan.md) owns test
selection and timing. The user's implementation-first instruction replaces
older per-edit checks, full-suite-per-commit requirements, separate reviewers
per issue and three-issue/milestone review cadences. Historical reports record
what happened; they do not impose recurring work. Product acceptance criteria
and explicit decisions are not waived by this process change.

- [AGENTS.md](../AGENTS.md): branch protection and project constraints.
- [Roadmap](roadmap.md): resume checkpoint, issue order and dependencies.
- Live GitHub issue: scoped problem, acceptance and concise completion result.
- [Engineering standards](engineering-standards.md): implementation rules.
- [Architecture](architecture.md), [decisions](architecture-decisions.md),
  [current status](current-status.md), [performance](performance.md): their
  respective current facts. Update only facts the change actually affects.

Keep one authority per fact. Do not create parallel plans, audit frameworks,
status ledgers or reports. Resume from the checkpoint instead of restarting an
inventory or replaying checks already valid for the unchanged code.

## Branch protection

Before every file change or Git mutation, run `git branch --show-current` and
require exactly `david_refactor`; otherwise stop. Check status and preserve
others' changes. Never check out or change `main`, create another branch or
worktree, or incorporate unrelated changes. Commit/push only when authorized;
all such work stays on `david_refactor`, targeting `origin/david_refactor` only.
Documentation permission is not commit or push permission.

## Implement one complete issue, then test

1. Read the current issue and prerequisites, inspect the affected code and
   relevant Git history. Find the smallest solution and the obsolete path it
   removes. Correct stale issue claims only when necessary to implement the
   right change; do not spend the block rewriting the backlog.
2. Implement the complete coherent issue at its existing owner. Remove replaced
   implementations, consumers, contracts, configuration and exclusive tests in
   the same block. Prefer direct code to wrappers, new interfaces or coordinators.
3. Briefly read the resulting diff: are responsibility, start, frame and end
   clearer? Remove duplicate state, forwarding and speculative safeguards. This
   is a short implementation pass, not a separate audit project.
4. Test the completed block using the smallest relevant checks in the test plan.
   Fix actual failures and rerun only affected checks. Do not test after each
   edit; an intermediate check needs a concrete failure or uncertainty that
   prevents further implementation.
5. Record one concise GitHub result: behavior changed, code/paths removed,
   relevant checks and outcomes, size delta and any unmet criterion. Update
   affected canonical facts, then commit the completed issue when authorized.
   Continue the next ready issue without repeating preparation or verification.

Delegate bounded implementation work with clear file ownership when useful.
Do not duplicate exploration or require an independent reviewer for every issue.
Use a focused second opinion for genuinely uncertain or broad ownership changes,
not a recurring review team. Human testing is optional; ask only for a remaining
explicit decision that blocks dependent work. Continue independent ready work.

## Keep the result smaller

Each refactor block must reduce production code, states and indirection without
sacrificing readability. Count authored configuration too; report source,
tests/tooling and documentation separately from the existing diff, without new
counting infrastructure. Moving, minifying or hiding code is not removal.
Necessary bug-fix growth is not a simplification success: revise toward real
removal or state the concrete unmet goal. Use `src/levels/test.level.ts` as the
readability reference. Never add generalized recovery, fallback paths or future
configuration for hypothetical needs.

Outside-scope simplifications belong in an existing matching issue or one
focused new issue with code evidence, target owner, removal and acceptance.
Record them briefly and continue the current implementation. Do not close unmet
technical or physical criteria. Preserve essential measurements and failure
facts once, with source identity and limits; do not archive every intermediate
step. A measured regression requires a fix or explicit acceptance. Local browser
results never establish installation 90 Hz. Open architecture/product choices
and exact benchmark-reference changes still require their specific decision.
