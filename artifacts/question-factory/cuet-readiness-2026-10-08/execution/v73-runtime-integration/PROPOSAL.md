# v7.3 integration artifact

The implementation proposal is in [WORKER-INTEGRATION.md](WORKER-INTEGRATION.md). The staged unified diff is [runtime-integration.patch](runtime-integration.patch). Both are artifact-only and have not been applied.

The diff leaves all academic-contract modules untouched. It adds a versioned, self-hashed profile in the existing `generation_brief` JSONB field, creates an operator-controlled profile/enqueue path, exposes the existing DB queue worker as `worker --queue`, dispatches both validation attempts through v7.3 only for explicitly pinned new jobs, and rechecks the current release before publication and student eligibility. Jobs without a profile keep their existing validator path; unknown profiles fail closed.

The manifest currently has no v7.3 release. Profile creation and enqueue therefore fail closed today. No migration is needed because `generation_brief` already exists. No provider calls, publication, production writes, or runtime edits were made.

The diff parses with `git apply --stat`. `git apply --check` could not validate the worker hunk against the current shared checkout; `scripts/pipeline/factory.mjs` is untracked in the worktree and its local context does not match the patch hunk. The patch was never applied. Resolve that context against the owner-reviewed checkout before application.
