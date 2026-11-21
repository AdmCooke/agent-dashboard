# System notes

Facts about specific systems that agents learned the hard way. Agents read this file only when a task touches one of these systems, so it costs nothing on other tasks. Add a dated line under the right heading. Move a note back to `PLAYBOOK.md` only if it applies to every task.

## Cloud sessions (claude.ai/code containers)

- 2026-11-19: The proxy carries HTTPS only. Plain http:// curls return 405, and hosts off the allowlist fail DNS. WebFetch fails the same way → add hosts with update_environment, and get http:// redirect proof from the user's own terminal or an outside fetch (Bright Data scrape_as_markdown reaches any host).
- 2026-11-19: No Claude-in-Chrome tools exist, and the user's Remote Control folder was listed as not_available → WP Admin, Elementor and Cloudflare changes need a desktop session with the Chrome extension. From the cloud, deliver drafts and exact change lists.
- 2026-11-19: Deleting a remote branch fails. `git push origin --delete` gets a 403 from the git proxy, `gh api -X DELETE .../git/refs/heads/<branch>` is refused, and the GitHub MCP has no delete-branch tool → hand the user the `git push origin --delete` commands to run locally.
- 2026-11-19: `gh api -X PATCH repos/...` to change a repo setting was blocked by auto mode as destructive → give the user the setting to change on github.com.
- 2026-11-09: `gh` REST reads work, GraphQL returns 403. `gh api repos/AdmCooke/agent-dashboard` says the repo is public.
- 2026-11-10: `claude-plugins-official` isn't preconfigured, and a plugin install is user scope (temporary) → add the marketplace with `claude plugin marketplace add anthropics/claude-plugins-official`, then save it in `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`). Remote MCP plugins also need their host allowed.
- 2026-11-21: With unused plugins off, 4 plugin MCP servers still fail to connect (canva, cloudflare, github, slack-by-salesforce), all with a proxy 403. Each duplicates a claude.ai connector that works, so the plugins stay on for their skills.
- 2026-11-21: A built-in safety check refused `rm -rf $D` on a scratch folder in a compound command, because it can't resolve the variable → make a fresh folder per try with `mktemp -d <scratchpad>/name.XXXX` instead of deleting and reusing one.
- 2026-11-21 (chief-of-staff): Sessions run agent-dashboard from the claude.ai account marketplace (`claude plugin list` showed 0.4.2 under `~/.claude/plugins/synced/`), not from the checkout. This review ran on Opus although the branch pins Haiku → after a plugin change merges, check `claude plugin list` in a new session before calling it live.
- 2026-11-21: The claude-security scan needs the Workflow tool, which its agent didn't have here, and its `/claude-security` menu skill is user-only (`disable-model-invocation: true`) → ask the user to type `/claude-security` instead of launching the agent.

## Plugin evals (`claude plugin eval`)

- 2026-11-21: The eval sandbox needs `bubblewrap` and `socat` on Linux, and cloud containers lack both → `apt-get install -y bubblewrap socat` (temporary, once per container).
- 2026-11-21: Runs use "don't ask" mode. With narrow grants like `Bash(git *)`, the Chief of Staff's multi-line `jq` digest and compound commands were denied, so it fell back to reading code and scored 0.625 → grant `Bash`, `Write` and `Edit` in full. Each run is a throwaway sandboxed folder.
- 2026-11-21: Runs don't load `CLAUDE.md` or `.claude/`, so each case's `scaffold.sh` builds its own git repo, `PLAYBOOK.md` and saved transcripts. The trace includes subagent tool calls (`parent_tool_use_id`), so `tool_used` graders see what the reviewer ran.
- 2026-11-21: `--keep-temp` leaves `/tmp/claude-eval-*` behind as root-owned agent output. Read only its `out/` folder, then remove it with `chmod -R u+rwX <dir> && rm -rf <dir>`.
- 2026-11-21: The default judge (Haiku) misgraded long reviews. Reports of 3,000+ characters that plainly met the criteria got FAIL from all three votes, and the CLI itself warns that LLM judges are noisy on long inputs → pass `--judge-model sonnet`. With it, the same suite went from 6 bad FAILs to none.
- 2026-11-21: Without `--model`, the main agent in each run is Sonnet, not the Opus model this repo's sessions use → pass `--model` to test what the user runs. The reviewer subagent inherits that model unless its frontmatter sets `model:`.
- 2026-11-21: Inside the eval sandbox, shell writes to the workspace are read-only (`OSError: Read-only file system`), while the Edit tool works. A reviewer that saved the playbook through Bash lost its lesson → the Chief of Staff now saves playbook edits with Edit only.
- 2026-11-21: Model comparison (Opus main, 5 cases x 5 runs, Sonnet judge, CLI cost estimates): Chief of Staff on Haiku 0.997 at $0.224 per run, Opus 0.994 at $0.273, Sonnet 0.983 at $0.236, no plugin 0.983 at $0.191. Every arm caught every planted mistake. The whole gap is the playbook save, which plain Opus did 0 of 5 times. Opus as main dispatched the reviewer in only 13 to 21 of 25 runs and reviewed by itself otherwise → pinned `model: haiku`. The suite is saturated, so add longer, harder cases before reading anything into the gaps between models.
- 2026-11-21 (chief-of-staff): A reviewer arm's score includes runs where the main agent never dispatched the reviewer (12 of 25 in the Opus arm), and those scored the same as dispatched runs (0.994 vs 0.995) → compare reviewer models on dispatched runs only. The plugin's whole edge came from playbook graders that the case prompt never asks for, so read it as "follows its own instructions", not "reviews better".
- 2026-11-21: Hard cases (a buried false claim among three agents, an untested macOS claim, a lesson seen three times), Opus main, 5 runs: Haiku and Opus reviewers 1.000, Sonnet 0.947, no plugin 0.893. All arms caught every planted mistake. The only gap was promoting the lesson to a standing rule (plain Opus 1 of 5, Haiku and Opus 5 of 5) → the Haiku pin stands. Across all 8 cases: Haiku 0.998 at $0.223 per run, Opus 0.996 at $0.308.
- 2026-11-21: A grader marked the Opus reviewer down 4 of 5 times for saying a changelog entry announced an unfinished rename, which was true → read the evidence behind a failing grader before counting it against an arm. Grade the claims the case is about, and allow true observations next to them.
- 2026-11-21: Two case files failed with "YAML Parse error: Unexpected token" because a `description:` held a colon followed by a space → quote `description` and `expected_outcome` values. `--case` takes one name or glob, and a second `--case` replaces the first → use `--tag` to run a group.
- 2026-11-21: Fixture trap: a scaffold ran the tests, then made an edit of exactly the same byte size in the same second. Python reused the stale `.pyc` and printed OK for broken code, so reviewers in the eval would have seen passing tests → run fixture tests with `PYTHONDONTWRITEBYTECODE=1`.

## Scheduled tasks

- 2026-11-16: `list_events` on a scheduled task's session fails with `elevated_session_untrusted_device`, and creating a one-time test task was blocked by auto mode → verify a scheduled run from repo state (`git log --format='%cn'`: committer `GitHub` means a web upload or API commit, not a git push).
- 2026-11-16: `update_trigger` on a task tied to the user's Mac returns `needs_device_approval` for any prompt change, and those tasks run on the Mac, not in a cloud container → hand the user the new prompt to apply on the Mac. Name, schedule and enabled changes need no approval.

## Hostinger

- 2026-11-10: Hostinger's MCP rejects the saved API token (`X-Proxy-Error: upstream auth failed`) and asks for OAuth via `auth.hostinger.com`, which the proxy blocks. Two fresh hPanel tokens both failed → use the Hostinger plugin from local Claude Code, where browser sign-in works. Check `claude mcp list` and the response headers before calling a plugin working.

## Premier website (WordPress + Elementor)

- 2026-11-15: `angie/execute-php` returns "Permission denied", and `build-composition`/`manage-elements` need the Atomic Editor, which has no HTML widget, so agents have no way to place custom HTML on a page (don't turn the Atomic Editor on for this) → create the draft with `elementor/create-page` and hand the user a paste-in HTML block.
- 2026-11-15: The proxy blocks `www.premierimprovementsone.com` but allows the apex domain → send `request-media-upload` curls to `https://premierimprovementsone.com/wp-json/...`.
- 2026-11-16: In AdmCooke/premier-website, `agent/<topic>` pushes fail with "directory file conflict" because a branch named `agent` exists → use `agent-<topic>` there.

## Brand checks

- 2026-11-19: The brand-check lint flags "#HIC" in the required license line "CT Lic. #HIC.0659657" as an uppercase hashtag → treat that one hit as a false positive. The license rule wins.
- 2026-11-21: A fixed brand-check skill went to the user's Drive Claude folder for upload. It ships with 88 test drafts, 33 of which the old lint got wrong, including this false positive, the signature's roof-price link and bold links. Until the user uploads it, the old lint is still live, so the note above still applies. The skill holds private details, so it never goes in this public repo.
