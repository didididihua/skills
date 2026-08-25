# skills

Personal agent skills, structured like [mattpocock/skills](https://github.com/mattpocock/skills).

## Install

```bash
npx skills@latest add didididihua/skills
```

Pick `hello` when the installer asks which skills to take.

## Skills

**User-invoked** (only when you type the name; Claude Code: `disable-model-invocation: true`; Codex: `policy.allow_implicit_invocation: false`)

- **[hello](./skills/hello/SKILL.md)**: Prefix every reply with `hello!hello!`.
