# ECC for Codex CLI

This supplements the root `AGENTS.md` with Codex-specific guidance.

## Model Defaults

Prefer the active Codex CLI default model and provider for both the top-level config and per-role configs.

- Leave `model` and `model_provider` unset unless you need a temporary reproducibility pin.
- Re-check the official Codex docs before pinning a specific model name, because model availability changes faster than this repo does.

## Skills Discovery

Codex auto-loads skills from `.agents/skills/`.

Each skill directory contains:
- `SKILL.md` - the full ECC skill content mirrored from `skills/`
- `agents/openai.yaml` - Codex interface metadata for discovery and implicit invocation

The Codex mirror tracks the full repo skill catalog rather than a small curated subset. That includes workflow quality skills, framework and language patterns, database guidance, security, research and API integrations, content and media, agentic workflows, infrastructure, document processing, and domain-specific operations skills.

Useful ways to inspect the current catalog:
- `rg --files .agents/skills -g SKILL.md`
- `Get-ChildItem .agents/skills`
- `rg -n "<topic>" .agents/skills/*/SKILL.md`

## MCP Servers

Treat the project-local `.codex/config.toml` as the ECC Codex baseline.

The reference baseline enables these default MCP servers:
- GitHub
- Context7
- Exa
- Memory
- Playwright
- Sequential Thinking

Add heavier or credential-specific servers in `~/.codex/config.toml` only when a task actually needs them.

## Multi-Agent Support

Codex supports multi-agent workflows behind `features.multi_agent = true`.

- Keep `.codex/config.toml` project-local when possible.
- Define shared roles under `[agents.<name>]`.
- Point each role at a TOML layer under `.codex/agents/`.
- Use `/agent` inside Codex CLI to inspect and steer child agents.

This repo ships two role layers:
- Generic harness roles: `explorer`, `reviewer`, `docs_researcher`
- Repo-mirrored specialist roles: one role config for every file under `agents/`

The mirrored role configs intentionally inherit the active Codex default model. They set sandbox and reasoning defaults, then point the agent back to the corresponding repo prompt as the source of truth.

## Key Differences from Claude Code

| Feature | Claude Code | Codex CLI |
|---------|-------------|-----------|
| Hooks | 8+ event types | Not yet supported |
| Context file | `CLAUDE.md` + `AGENTS.md` | `AGENTS.md` only |
| Skills | Skills loaded via plugin | `.agents/skills/` directory |
| Commands | `/slash` commands | Instruction-based |
| Agents | Subagent Task tool | Multi-agent via `/agent` and `[agents.<name>]` roles |
| Security | Hook-based enforcement | Instruction + sandbox |
| MCP | Full support | Supported via `config.toml` and `codex mcp add` |

## Security Without Hooks

Since Codex lacks hook parity, ECC enforcement here is instruction-based:
1. Validate inputs at system boundaries.
2. Never hardcode secrets; use environment variables.
3. Run dependency audits before committing.
4. Review diffs before every push.
5. Prefer `sandbox_mode = "workspace-write"` with `approval_policy = "on-request"` for normal development.
