# skills

Personal agent skills, structured like [mattpocock/skills](https://github.com/mattpocock/skills).

## Install

```bash
npx skills@latest add didididihua/skills
```

Pick `hello`, `do-plan`, `go-style`, or `feature-design-doc` when the installer asks which skills to take.

## Skills

**User-invoked** (only when you type the name; Claude Code: `disable-model-invocation: true`; Codex: `policy.allow_implicit_invocation: false`)

- **[hello](./skills/hello/SKILL.md)**: Prefix every reply with `hello!hello!`.
- **[do-plan](./skills/do-plan/SKILL.md)**: Land an existing plan by user-visible slices. TDD only at named seams; re-read the original plan each task.

**Coding guidance** (automatic selection when relevant; also available by explicit invocation)

- **[go-style](./skills/go-style/SKILL.md)**: Go backend style inspired by Nexus Agent: explicit dependency wiring, readable business phases, useful comments, and clear resource ownership. Includes runnable examples and optional FFMAAS proto/ent guidance while preserving the target project's architecture.

**Docs and design** (automatic selection when relevant; also available by explicit invocation)

- **[feature-design-doc](./skills/feature-design-doc/SKILL.md)**: From a requirement to one switchable HTML design doc: requirement design (需求设计), interactive prototype (原型交互), technical design (技术方案) and decision record (决策记录). Any part can be written alone. Diagrams follow one style guide (layered architecture, change board, ELK flowcharts, sequence diagrams with marked new steps) and each diagram carries a reading note. Needs Node and a local Chrome; run `npm install` in the skill's `scripts/` once. See [the example](./skills/feature-design-doc/examples/member-birthday/).

## Templates

Not skills. Copy into a target repo and fill in.

- **[agent-template.md](./templates/agent-template.md)**: Project feedforward skeleton (constitution, SDD, C4, howtos, standards, ADR, bug notebook).
