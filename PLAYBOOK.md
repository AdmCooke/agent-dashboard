# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.
- When the user asks you to merge a pull request, merge it. Their request is enough; don't wait for checks or a review first.
- Name branches you create `agent/<topic>`. Force-push (`--force-with-lease`, never `--force`) only to an `agent/` branch you created in this session, never to anyone else's branch or to `main`.
- The repo is public: treat every commit, branch name and PR text as public. Never put secrets, credentials, email addresses or private notes in them.
- Before editing, `git fetch` and start a new `agent/` branch from `origin/main`, even when the checkout is on another branch.
- After your pull request merges, delete your own branch where you can. Where you can't (cloud sessions), list it for the user with the command to delete it.
- A change is "done" only once it's in the repo (merged) or on claude.ai. A change that lives only in this cloud container (user settings, a local plugin install) is "temporary": say so, and say how to make it permanent.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume? Facts about GitHub, settings or plugins need a read from that system in this run (e.g. `gh api repos/{owner}/{repo}`).
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons`.
5. If I added or changed a permission or safety rule, did I test a command it must block in a disguised form (for git: `src:dst` refspecs, `refs/heads/...`, a second refspec), not only the obvious cases?

## Lessons

- 2026-10-30 (main): Turning off 10 unused plugins cut a fresh session's starting context only from 46.4k to 42.4k tokens, because connector tools load on demand → measure before you promise savings from config changes.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md` → when a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.
- 2026-10-30 (chief-of-staff): A launch prompt said "no other subagents have run yet", but the session already had 3 finished subagents and 2 merged PRs → describe session state only from what you listed yourself (e.g. `ls <session>/subagents`), not from memory.
- 2026-10-30 (chief-of-staff): The GitHub merge tool rejects a short `expectedHeadSha` → pass the full 40-char `git rev-parse HEAD`.
- 2026-10-30 (chief-of-staff): A force push to an already-pushed branch was blocked as "Git Destructive", even on the agent's own branch → if the permission check blocks it, push to a new branch instead of retrying. (The user-level allow rule for `--force-with-lease` exists only in one cloud container.)
- 2026-11-09 (chief-of-staff): The allow rule `Bash(git push --force-with-lease *)` didn't check whose branch it was, and `origin` has branches from other sessions (`claude/*`, `premier-sales-agent`) → narrowed to `agent/` branches; before force-pushing, still confirm you created that branch in this session.
- 2026-11-19 (chief-of-staff): The narrowed rule `Bash(git push --force-with-lease* origin agent/*)` still matches the source side of a refspec: fresh `claude -p` dry runs of `... origin agent/probe:premier-sales-agent` and `... origin agent/probe:refs/heads/main` were both ALLOWED with no prompt (the deny `*:main` misses `:refs/heads/main`) → fixed with a PreToolUse hook (`.claude/hooks/guard-force-push.sh`) that blocks any force push whose destination isn't an `agent/` branch; fresh-session tests blocked all 4 disguised forms.
- 2026-11-19 (chief-of-staff): After a squash merge, the local checkout stayed on the merged branch (`cos-review-2`) while other sessions moved `origin/main` 8 commits ahead → before editing `PLAYBOOK.md`, `git fetch` and start a new `agent/` branch from `origin/main`.
- 2026-11-09 (chief-of-staff): Main told the user "the repo is private" without checking. `gh api repos/AdmCooke/agent-dashboard` says public → `gh` REST reads work here (GraphQL returns 403), so check before advising.
- 2026-11-09 (chief-of-staff): A nested `claude -p` run writes into the parent session's transcript as `user:` turns ("Run exactly…", "Reply with exactly: OK") → reviewers: don't mistake those for the user's requests.
- 2026-11-10 (main): `claude-plugins-official` isn't preconfigured in cloud containers, and a plugin install there is user scope (temporary) → add the marketplace with `claude plugin marketplace add anthropics/claude-plugins-official`, then save it in `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`). Remote MCP plugins also need their host allowed (Hostinger's `mcp.hostinger.com` got a proxy 403).
- 2026-11-10 (main): Hostinger's MCP still fails after install: `mcp.hostinger.com` now passes the proxy, but it rejects the saved "Hostinger API token" (`X-Proxy-Error: upstream auth failed`) and asks for OAuth via `auth.hostinger.com`, which the proxy blocks → check `claude mcp list` and the response headers before calling a plugin working. Two fresh hPanel tokens both failed, so use the Hostinger plugin from local Claude Code, where browser sign-in works.
- 2026-11-15 (main): Premier WordPress MCP: `angie/execute-php` returns "Permission denied" and `build-composition`/`manage-elements` need the Atomic Editor, and even with it on there is no HTML widget, so custom HTML can't be placed on a page by agent (don't turn the Atomic Editor on for this) → create the draft with `elementor/create-page` and hand the user a paste-in HTML block. The proxy blocks `www.premierimprovementsone.com` but allows the apex domain, so send `request-media-upload` curls to `https://premierimprovementsone.com/wp-json/...`.
- 2026-11-16 (main): `list_events` on a scheduled task's session fails with `elevated_session_untrusted_device`, and creating a one-time test task was blocked by auto mode → verify a scheduled run from repo state instead (`git log --format='%cn'`: committer `GitHub` means a web upload or API commit, not a git push).
- 2026-11-16 (main): In AdmCooke/premier-website, `agent/<topic>` pushes fail with "directory file conflict" because a branch named `agent` exists → use `agent-<topic>` there.
- 2026-11-16 (main): `update_trigger` on a task tied to the user's Mac returns `needs_device_approval` for any prompt change, and those tasks run on the Mac, not in a cloud container (so cloud `add_repo` access doesn't reach them) → hand the user the new prompt to apply on the Mac. Name, schedule and enabled changes need no approval.
- 2026-11-19 (main): The cloud container's proxy carries HTTPS only: plain http:// curls return 405 and non-allowlisted hosts fail DNS, and WebFetch fails the same way → add hosts with update_environment for HTTPS, and get http:// redirect proof from the user's own terminal or an outside fetch (Bright Data scrape_as_markdown reaches any host).
- 2026-11-19 (main): No Claude-in-Chrome tools exist in a cloud session, and the user's Remote Control folder was listed as not_available → WP Admin, Elementor and Cloudflare changes need a desktop session with the Chrome extension; from the cloud, deliver drafts and exact change lists instead.
- 2026-11-19 (main): The brand-check lint flags "#HIC" in the required license line "CT Lic. #HIC.0659657" as an uppercase hashtag → treat that one hit as a false positive, the license rule wins.
- 2026-11-19 (main): Remote branches can't be deleted from a cloud session: `git push origin --delete <branch>` gets a 403 from the git proxy, `gh api -X DELETE .../git/refs/heads/<branch>` is refused as a write path, and the GitHub MCP has no delete-branch tool → hand the user the `git push origin --delete` commands to run locally, or point them to the branch list on github.com.

- 2026-11-19 (main): Deny rules with a `:` in them (`Bash(... origin agent/*:*)`) matched nothing in fresh-session tests, while the same push was allowed → permission patterns can't guard `src:dst` refspecs; use a PreToolUse hook and test it.
- 2026-11-19 (main): `gh api -X PATCH repos/...` to change a repo setting (auto-delete merged branches) was blocked by auto mode as destructive → give the user the setting to change on github.com.- 2026-11-21 (main): The premier-sales-agent branch held two customer email addresses in this public repo, and its daily-run file had drifted far from the live Sales Daily task, which runs from its own prompt with no plugins → scan text for customer names and email addresses before you push, and read a task's live prompt with list_triggers instead of trusting a repo copy. Each list_triggers page is large because it lists every connector, so stop paging once you find the task.

<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->

## Open questions for the user

## Answers from the user

- 2026-10-30: Merging when asked: "my request is enough." → standing rule.
- 2026-10-30: Keep the `ponytail` plugin on for reviewer agents: "Yes it is enough."
- 2026-10-30: Force-push: allowed "to their own branches." → standing rule.
- 2026-11-09: Force-push scope: the user asked for best practice → narrowed to `agent/` branches (allow rule `Bash(git push --force-with-lease* origin agent/*)`) → standing rule.
- 2026-11-09: Public repo: best practice → treat all pushed text as public → standing rule. Whether it should stay public is the user's call.
- 2026-11-09: "Done": best practice → only once it's in the repo or on claude.ai; container-only changes are reported as temporary → standing rule.
- 2026-11-19: Close the force-push gap: best practice → a PreToolUse hook that checks each force push's destination, instead of the two deny rules (the colon rule didn't work, and the other blocked flags after the branch name) → in `.claude/settings.json`.
- 2026-11-19: Branch cleanup: best practice → agents delete their own merged branches where they can, else list them for the user; GitHub's "Automatically delete head branches" setting is for the user to turn on; always branch off `origin/main` → standing rules.
- 2026-11-19: Verdict: best practice → ⚠️ is right when an agent states a safety guarantee it only partly tested, even if the rest of its work is correct.
