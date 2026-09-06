# Refactor Workflow

This workflow governs `david_refactor`. Fix causes at existing owners and make
the system easier to read. Bug fixes may change behavior; name that change.
The binding [target architecture](target-architecture.md) owns target direction
and removal obligations. Its explicitly open choices remain decisions.

## One authority per fact

| Source | Owns |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Branch protection and required reading |
| [Engineering standards](engineering-standards.md) | Implementation rules |
| [Architecture](architecture.md), [decisions](architecture-decisions.md) | As-built ownership and confirmed constraints |
| Live GitHub issue | Problem, acceptance criteria, decisions and completion |
| [Roadmap](roadmap.md) | Order, prerequisites, current checkpoint and human review count |
| [Test plan](refactor-test-plan.md) | Verification and test retention |
| [Current status](current-status.md), [performance](performance.md) | As-built capabilities and measured performance |
| `docs/evidence/issue-<number>/` | Essential dated results, identities and failure evidence |

Link these sources instead of copying their changing facts. Replace stale
current statements; keep necessary history in evidence or issue comments.
Do not add another plan, status ledger or completion template.

## Branch and scope

- Before every mutation, including generated artifacts, and every commit, pull,
  rebase, merge or push, run `git branch --show-current`; require exactly
  `david_refactor`. Otherwise stop without changing anything.
- Check `git status` and preserve others' changes. Never check out or change
  `main`, create another branch/worktree, or incorporate unrelated PRs.
- Commit and push only with explicit authorization, only on this branch and
  toward `origin/david_refactor`. Documentation permission is not Git permission.
- Implement one issue at a time. An independent ready issue can follow a
  technically implemented issue awaiting external acceptance, but cannot cross
  an unmet dependency or human gate. User-requested review corrections belong
  to the reviewed block; they do not imply its acceptance.

## Issue loop

1. Read the live issue, comments, prerequisites, relevant code/tests and Git
   history. Reconcile stale claims against the checkout before implementation.
2. Before substantial work, state what becomes simpler, what disappears, which
   existing owner keeps the responsibility, and why any added structure is needed.
   Resolve dependent open decisions with a concrete result, recommendation and
   consequences. Routine implementation choices need no extra gate. Check library
   documentation before library-specific work; use Context7 first when available.
3. Capture the relevant baseline from this branch. Identify the source revision
   and dirty diff, not just HEAD. Apply the test plan according to actual risk.
4. Implement at the existing owner. Remove replaced code, contracts, settings,
   consumers and exclusive tests together. Do not retain compatibility paths
   without a current consumer and an explicit reason.
5. Review the complete affected start, frame and end with a separate reviewer.
   Apply the size and architecture checks below, then verify the final change.
6. Update affected canonical facts and one concise issue result: change/removal,
   commands and results, evidence, remaining acceptance, integration status.
   Check fulfilled criteria; close only when the required acceptance exists.

## Size and architecture check

Every implementation ends with these questions, answered briefly in its issue:

- Is responsibility clearer, and can start, one frame, end and visitor restart
  be read directly at their existing owner?
- Which obsolete paths, states, wrappers, contracts and tests actually disappear?
- Is every new file, abstraction, dependency and persistent state necessary for
  a current behavior? Reuse/direct code comes before another owner or interface.
- Could existing state supply an argument or derived fact instead of carrying
  it separately? Do similar operations truly share semantics and lifetime?
- Does the retained test suite protect current behavior rather than the old
  implementation? Apply the test plan's deletion rules.
- Report growth/removal separately for production logic, explicit configuration,
  tests/test tools, and documentation/measurement artifacts, including untracked
  files. Did states, forwarding, dependencies and required file jumps decrease?

Each refactor block must reduce production code, states and indirection while
preserving readability and verified behavior. Necessary bug-fix additions must
be offset by real removal in that block; growth is an unmet refactor outcome.
Count authored configuration too, and report tests and documentation separately.
Remove superseded paths and exclusive tests together. Moving, minifying or
hiding code outside the count is not removal. Use `test.level.ts` as the reference.

Fallow supplements review: distinguish inherited findings from regressions,
prove new boundary rules with a temporary violation, then remove that fixture.
Never suppress a finding or update a baseline merely to make a gate green.
Before changing confirmed ownership or adding a structural abstraction, obtain
approval for the concrete owner/consumer/removal proposal unless already given.

## Human gates

| Trigger | Required acceptance |
| --- | --- |
| Every issue | Code/architecture review and applicable verification |
| Visible behavior | Prepared human browser check; required device checks remain separate |
| Three implemented issues or milestone boundary, whichever comes first | Cumulative human behavior, architecture and size review before another implementation |
| Open structural or product choice | Decision before dependent implementation |
| M0 and later milestones | Integrated behavior, ownership, measurement/evidence review |

Count locally implemented work even when hardware acceptance is pending. The
roadmap alone records the count and last actual review. Prepare three to five
concrete actions in a visible production browser, with expected behavior and
remaining uncertainties. Record the actual response and tested state; silence,
a request to correct review findings, or a successful test is not acceptance.
New owners/abstractions, unplanned content changes and unjustified growth need
an explicit decision unless already approved. Basic Windows-PCVR startup and
visitor restart must be investigated early enough to inform dependent designs.
Present the concrete restart operation before implementation; page reload is
a candidate to validate on Windows-PCVR, not assumed automatic XR re-entry.

## Evidence, feedback and integration

Retain the smallest durable evidence that supports the claim: exact source/diff
identity, conditions, commands, individual comparison results, decisive failure
facts and limits. Store shared metadata once when this simplifies reading.
Raw frames, repeated warnings, debugger locals and traces normally stay in
ignored diagnostic output; keep essential failures and measurements in the
repository or their GitHub issue before retiring temporary material. Do not
copy full reports into several issue folders or document every intermediate
step. Never delete unexplained failures or replace before data with a pass.

Correct current-issue failures in scope. For independent defects or removal
opportunities, search existing issues first, then update a matching issue or
create one focused issue with code evidence, target owner, removal and acceptance.
Keep it outside the active implementation. Use at most one status label:
`status:ready`, `status:in-progress`, `status:blocked`, `status:awaiting-review`.
A measured regression remains blocking until fixed or explicitly accepted.

When Git operations are authorized, map focused issue commits to predecessors
and evidence. Read overlapping PRs without switching branches. One accumulated
branch produces one accumulated PR diff; closed issues are not proof of
integration. Never merge/rebase/push to `main` under this workflow.
