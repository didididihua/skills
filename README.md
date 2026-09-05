# skills

Personal agent skills, structured like [mattpocock/skills](https://github.com/mattpocock/skills).

## Install

```bash
npx skills@latest add didididihua/skills
```

Pick `hello` or `do-plan` when the installer asks which skills to take.

## Skills

**User-invoked** (only when you type the name; Claude Code: `disable-model-invocation: true`; Codex: `policy.allow_implicit_invocation: false`)

- **[hello](./skills/hello/SKILL.md)**: Prefix every reply with `hello!hello!`.
- **[do-plan](./skills/do-plan/SKILL.md)**: Land an existing plan by user-visible slices. TDD only at named seams; re-read the original plan each task.

## Templates

Not skills. Copy into a target repo and fill in.

- **[agent-template.md](./templates/agent-template.md)**: Project feedforward skeleton (constitution, SDD, C4, howtos, standards, ADR, bug notebook).
