#!/usr/bin/env node
// Build one self-contained HTML page for a feature. The requirement design (需求设计), the prototype (原型交互),
// the technical design (技术方案) and the decision record (决策记录) are views of the same page, switched
// from the top right. Any subset works: a view that is not written yet shows a disabled button.
// Usage: node build.mjs <any of the docs> [-o <out.html>]
// The other docs are found through front matter (requirement: / prototype: / design: / decisions:) or sibling file names.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import hlJson from 'highlight.js/lib/languages/json';
import hlSql from 'highlight.js/lib/languages/sql';
import hlJava from 'highlight.js/lib/languages/java';
import hlYaml from 'highlight.js/lib/languages/yaml';
import hlXml from 'highlight.js/lib/languages/xml';
import hlBash from 'highlight.js/lib/languages/bash';
import hlProps from 'highlight.js/lib/languages/properties';
import hlTs from 'highlight.js/lib/languages/typescript';

for (const [name, lang] of Object.entries({ json: hlJson, sql: hlSql, java: hlJava, yaml: hlYaml, xml: hlXml, bash: hlBash, properties: hlProps, typescript: hlTs })) {
  hljs.registerLanguage(name, lang);
}
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', 'assets');
const CACHE = path.join(os.homedir(), '.cache', 'feature-design-doc', 'mermaid');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Local profile: product skins and defaults that should not live in the skill itself (see references/profile.md).
const HOME = process.env.FEATURE_DESIGN_DOC_HOME || path.join(os.homedir(), '.config', 'feature-design-doc');
// Diagram text is 14px. A diagram may scale down until its text renders at 12px; below that its figure scrolls.
const MIN_SCALE = 12 / 14;

// Inline badge vocabulary: 【新增】 in Markdown renders as a colored badge.
const BADGES = {
  新增: 'new', 修改: 'mod', 改动: 'mod', 不变: 'keep', 复用: 'keep', 现状: 'keep', 删除: 'del',
  已确认: 'ok', 推断: 'guess', 待确认: 'todo', 阻塞: 'block', 风险: 'risk', 已撤销: 'keep', 被替代: 'keep',
  高: 'hi', 中: 'mid', 低: 'lo',
  产品: 'pm', 研发: 'dev', 测试: 'qa', 前端: 'dev', 运维: 'dev', 三方: 'ext', 外部: 'ext',
  可选: 'opt', 一期: 'ok', 后续: 'opt',
};
const NOTE_KIND = { new: 'new', mod: 'chg', keep: 'cur' };
const CALLOUTS = { NOTE: ['note', '说明'], TIP: ['tip', '结论'], IMPORTANT: ['important', '重点'], WARNING: ['warning', '注意'], CAUTION: ['caution', '风险'] };
const STATUS = { 草稿: 'st-draft', 评审中: 'st-review', 已定稿: 'st-final', 定稿: 'st-final' };
const ID_PATTERN = /^(?:[A-Z]{1,3}\d{1,2}|[A-Z]{2,4}-\d{1,2})$/;
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const CLASS_DEFS = {
  new: 'fill:#f3f0ff,stroke:#6b4eff,stroke-width:1.75px,color:#2f1f8f',
  mod: 'fill:#fff7e6,stroke:#e09a2b,stroke-width:1.75px,color:#6b3d00',
  keep: 'fill:#f8fafc,stroke:#cbd5e1,stroke-width:1.25px,color:#475569',
  ext: 'fill:#ffffff,stroke:#64748b,stroke-width:1.25px,stroke-dasharray:5 4,color:#0f172a',
  warn: 'fill:#fffbeb,stroke:#d97706,stroke-width:1.25px,stroke-dasharray:4 3,color:#78350f',
  bad: 'fill:#fef2f2,stroke:#ef4444,stroke-width:1.25px,color:#7f1d1d',
};
const LEGEND = { new: '新增', mod: '改动', keep: '不变、复用', ext: '外部系统', warn: '异常处理', bad: '出错' };
// Sequence diagrams mark new steps with this rect color.
const NEW_RECT = /rect\s+rgba?\(\s*107\s*,\s*78\s*,\s*255/;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseArgs(argv) {
  const args = { input: null, output: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-o') args.output = argv[++i];
    else args.input = argv[i];
  }
  if (!args.input) {
    console.error('usage: node build.mjs <doc.md> [-o <out.html>]');
    process.exit(2);
  }
  return args;
}

function parseFrontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(src);
  if (!m) return [{}, src];
  const meta = {};
  let key = null;
  const unquote = v => v.trim().replace(/^(['"])(.*)\1$/, '$2');
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && key) {
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1]; meta[key] = kv[2] === '' ? [] : unquote(kv[2]); }
  }
  return [meta, src.slice(m[0].length)];
}

// Turn GitHub alerts (> [!NOTE] title) into callout containers, leaving fenced code and containers' own quotes alone.
function preprocess(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[2][0].repeat(f[2].length);
      else if (line.trim().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    const a = !fence && /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/.exec(line);
    if (!a) { out.push(line); continue; }
    const body = [];
    while (i + 1 < lines.length && /^>/.test(lines[i + 1])) body.push(lines[++i].replace(/^>\s?/, ''));
    out.push(`::: callout-${a[1].toLowerCase()} ${a[2]}`.trimEnd(), ...body, ':::');
  }
  return out.join('\n');
}

function listItems(body, marker = /^[-*]\s+(.*)$/) {
  const items = [];
  let cur = null;
  for (const line of body.split('\n')) {
    const m = marker.exec(line);
    if (m) { cur = { head: m, lines: [m[m.length - 1]] }; items.push(cur); }
    else if (cur && /^\s+\S/.test(line)) cur.lines.push(line.replace(/^ {2,4}/, ''));
    else if (cur && !line.trim()) cur.lines.push('');
    else cur = null;
  }
  return items.map(it => ({ head: it.head, text: it.lines.join('\n').trim() }));
}

function splitHead(text) {
  const m = /^\*\*(.+?)\*\*[ \t]*([\s\S]*)$/.exec(text);
  return m ? [m[1], m[2].trim()] : ['', text];
}

function sectionId(num, prefix = '') {
  if (num === '附录') return prefix + 'appx';
  const appx = /^附录\s?([A-Z])$/.exec(num);
  if (appx) return prefix + 'appx-' + appx[1].toLowerCase();
  return prefix + 'sec-' + num.replace(/\./g, '-');
}

function highlightChain(text) {
  const re = /(\[[a-z][a-z0-9-]{1,30}\]\s+[A-Za-z0-9_.\/-]+?\.(?:java|kt|go|py|xml|yml|yaml|properties|sql|jsx?|tsx?|vue|less|scss)(?::\d+(?:-\d+)?)?)|(:\d+(?:-\d+)?)|(→|├─|└─)/g;
  let out = '', pos = 0, m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(pos, m.index));
    const cls = m[1] ? 'rf' : m[2] ? 'ln' : 'ar';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    pos = m.index + m[0].length;
  }
  return out + esc(text.slice(pos));
}

function createMarked(state) {
  const marked = new Marked({ gfm: true, breaks: false });
  const inline = s => marked.parseInline(s);
  const block = s => {
    const html = marked.parse(s).trim();
    const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
    return single && !single[1].includes('<p>') ? single[1] : html;
  };

  // Change type of an item from its leading or trailing badge: 【新增】 → new.
  const kindOf = text => {
    const b = /^【([^】]+)】\s*/.exec(text) || /\s*【([^】]+)】\s*$/.exec(text);
    const kind = b && BADGES[b[1]];
    return kind ? { kind, label: b[1], rest: (text.slice(0, b.index) + text.slice(b.index + b[0].length)).trim() } : { kind: '', label: '', rest: text };
  };
  // Components drawn in HTML share the figure frame of rendered diagrams: caption and legend underneath.
  const figureWrap = (kind, inner, caption, used) => {
    const legend = used ? ['new', 'mod', 'keep', 'ext'].filter(k => used.has(k)).map(k => `<span class="lg lg-${k}"><i></i>${LEGEND[k]}</span>`).join('') : '';
    return `<figure class="dg dg-${kind}">${inner}${caption || legend ? `<figcaption>${caption ? `<span class="cap">${inline(caption)}</span>` : ''}${legend}</figcaption>` : ''}</figure>\n`;
  };

  const containers = {
    // Grouped board: one column per group (service, requirement, owner), one tagged item per line. Use it instead of mind maps.
    board(t) {
      const used = new Set();
      const cols = listItems(t.body).map(({ text }) => {
        const [title, rest] = splitHead(text);
        const desc = [], items = [];
        for (const line of rest.split('\n')) {
          const m = /^[-*]\s+(.+)$/.exec(line.trim());
          if (!m) { if (line.trim()) desc.push(line.trim()); continue; }
          const { kind, label, rest: body } = kindOf(m[1]);
          const [main, note] = body.split(/\s+\|\s+/);
          if (kind) used.add(kind);
          items.push(`<li class="bi${kind ? ' bi-' + kind : ''}">${label ? `<span class="b b-${kind}">${label}</span>` : ''}<span class="bt">${inline(main)}${note ? `<small>${inline(note)}</small>` : ''}</span></li>`);
        }
        return `<section class="bcol"><h4>${inline(title || rest)}</h4>${desc.length ? `<p>${inline(desc.join(' '))}</p>` : ''}<ul>${items.join('')}</ul></section>`;
      });
      return figureWrap('board', `<div class="board-grid">${cols.join('')}</div>`, t.arg, used);
    },
    // Layered architecture: one band per layer, one box per component, colored by change type; {ext} marks an outside layer.
    arch(t) {
      const used = new Set();
      const rows = listItems(t.body).map(({ text }) => {
        let ext = false;
        const [title, rest] = splitHead(text.replace(/\s*\{ext\}/, () => { ext = true; return ''; }));
        const desc = [], boxes = [];
        for (const line of rest.split('\n')) {
          const m = /^[-*]\s+(.+)$/.exec(line.trim());
          if (!m) { if (line.trim()) desc.push(line.trim()); continue; }
          const [head, note] = m[1].split(/\s+\|\s+/);
          const { kind, label, rest: name } = kindOf(head);
          if (kind) used.add(kind);
          boxes.push(`<div class="ab${kind ? ' ab-' + kind : ''}"><div class="ab-t">${inline(name)}${label ? `<span class="b b-${kind}">${label}</span>` : ''}</div>${note ? `<div class="ab-d">${inline(note)}</div>` : ''}</div>`);
        }
        return `<div class="arch-row${ext ? ' ext' : ''}"><div class="arch-label"><b>${inline(title)}</b>${desc.length ? `<span>${inline(desc.join(' '))}</span>` : ''}</div><div class="arch-boxes">${boxes.join('')}</div></div>`;
      });
      return figureWrap('arch', `<div class="arch">${rows.join('')}</div>`, t.arg, used);
    },
    // Ordered phases (实施步骤、上线顺序): numbered left to right; {par} marks a step whose parts run in parallel.
    steps(t) {
      const items = listItems(t.body).map(({ text }, i) => {
        let par = false;
        const clean = text.replace(/\s*\{par\}\s*$/, () => { par = true; return ''; });
        const [title, rest] = splitHead(clean);
        return `<li class="st${par ? ' par' : ''}"><span class="sn">${i + 1}</span><div class="sb"><div class="stt">${inline(title || rest)}${par ? '<span class="b b-opt">可并行</span>' : ''}</div>${title && rest ? `<div class="sd">${block(rest)}</div>` : ''}</div></li>`;
      });
      return figureWrap('steps', `<ol class="steps-row">${items.join('')}</ol>`, t.arg);
    },
    // 图解: how to read the diagram right above. "**3–5** 说明" keys a note to step numbers or node names.
    explain(t) {
      const rows = listItems(t.body).map(({ text }) => {
        const [k, v] = splitHead(text);
        return k ? `<div class="ex-row"><dt>${inline(k)}</dt><dd>${block(v)}</dd></div>` : `<div class="ex-row ex-plain"><dd>${block(text)}</dd></div>`;
      });
      return `<div class="explain"><div class="explain-h">${inline(t.arg || '图解')}</div><dl>${rows.join('')}</dl></div>\n`;
    },
    kpi(t) {
      const tiles = listItems(t.body).map(({ text: item }) => {
        const [value, rest] = splitHead(item);
        let tone = '';
        const text = rest.replace(/\s*\{(warn|ok)\}\s*$/, (_, k) => { tone = ' ' + k; return ''; });
        const [label, note] = text.split(/\s*\|\s*/);
        return `<div class="k${tone}"><div class="kv">${inline(value)}</div><div class="kl">${inline(label || '')}</div>${note ? `<div class="kn">${inline(note)}</div>` : ''}</div>`;
      });
      return `<div class="kpi">${tiles.join('')}</div>\n`;
    },
    cards(t) {
      const mods = t.arg.split(/\s+/).filter(Boolean);
      const numbered = mods.includes('num') || mods.includes('roles');
      const cards = listItems(t.body).map(({ text: item }, i) => {
        const [title, rest] = splitHead(item);
        const icon = numbered ? `<span class="i">${mods.includes('roles') ? esc(title) : String(i + 1).padStart(2, '0')}</span>` : '';
        const head = mods.includes('roles') ? `<div class="h">${icon}</div>` : `<div class="h">${icon}<span>${inline(title)}</span></div>`;
        return `<div class="card">${title ? head : ''}${rest ? block(rest) : ''}</div>`;
      });
      return `<div class="cards ${mods.join(' ')}">${cards.join('')}</div>\n`;
    },
    facts(t) {
      const rows = listItems(t.body).map(({ text: item }) => {
        const [k, v] = splitHead(item);
        return `<div><dt>${inline(k)}</dt><dd>${inline(v)}</dd></div>`;
      });
      return `<dl class="facts">${rows.join('')}</dl>\n`;
    },
    // One entry of the decision record. 状态 (its leading badge) and 日期 go to the header; 「决策 N」 anywhere links here.
    decision(t) {
      const [no, title] = t.arg.includes('|') ? t.arg.split(/\s*\|\s*/) : ['决策', t.arg];
      let status = '', date = '';
      const rows = [];
      for (const { text: item } of listItems(t.body)) {
        const [k, v] = splitHead(item);
        if (k === '日期') { date = v; continue; }
        const b = k === '状态' && /^【([^】]+)】\s*/.exec(v);
        if (b && BADGES[b[1]]) {
          status = b[1];
          if (v.slice(b[0].length).trim()) rows.push([k, v.slice(b[0].length)]);
          continue;
        }
        rows.push([k, v]);
      }
      const n = /\d+/.exec(no);
      const id = n ? `${state.prefix}dec-${n[0]}` : '';
      if (id) {
        const plain = title.replace(/【[^】]*】/g, '').replace(/[*`]/g, '').trim();
        state.ids.add(id);
        state.links.set(`决策 ${n[0]}`, id);
        state.titles[id] = `决策 ${n[0]} ${plain}`;
        if (state.role === 'decision') state.toc.push({ depth: 3, id, num: `决策 ${n[0]}`, title: plain });
      }
      const meta = (status ? `<span class="b b-${BADGES[status]}">${status}</span>` : '') + (date ? `<span class="dd">${esc(date)}</span>` : '');
      const dl = rows.map(([k, v]) => `<dt${k === '选择' ? ' class="pick"' : ''}>${inline(k)}</dt><dd${k === '选择' ? ' class="pick"' : ''}>${block(v)}</dd>`).join('');
      return `<div class="decision"${id ? ` id="${id}"` : ''}><div class="dh"><span class="dn">${esc(no)}</span><span class="dtl">${inline(title)}</span>${meta ? `<span class="dm">${meta}</span>` : ''}</div><dl>${dl}</dl></div>\n`;
    },
    // Pages grouped by the task they serve; each sub-item "P1 标题 【改动】" links to a prototype page.
    journey(t) {
      const cols = listItems(t.body).map(({ text }) => {
        const [title, rest] = splitHead(text);
        const desc = [], links = [];
        for (const line of rest.split('\n')) {
          const p = /^[-*]\s+(P\d+)\s+(.+?)\s*(?:【([^】]+)】)?\s*$/.exec(line.trim());
          if (p) links.push(`<a href="#${p[1]}"><span><b>${p[1]}</b>${inline(p[2])}</span>${p[3] && BADGES[p[3]] ? `<span class="b b-${BADGES[p[3]]}">${p[3]}</span>` : ''}</a>`);
          else if (line.trim()) desc.push(line.trim());
        }
        return `<div class="jcol"><h4>${inline(title)}</h4>${desc.length ? `<p>${inline(desc.join(' '))}</p>` : ''}${links.join('')}</div>`;
      });
      return `<div class="journey">${cols.join('')}</div>\n`;
    },
    // One block of content with several states, switched by a horizontal segmented control.
    switch(t) {
      const panes = [];
      let cur = null;
      for (const line of t.body.split('\n')) {
        const h = /^####\s+(.+)$/.exec(line);
        if (h) { cur = { label: h[1].trim(), lines: [] }; panes.push(cur); }
        else if (cur) cur.lines.push(line);
      }
      if (!panes.length) { state.warnings.push('switch without #### panes'); return ''; }
      const id = state.prefix + 'sw-' + (++state.autoId);
      const buttons = panes.map((p, i) => `<button type="button" data-pane="${i}" aria-pressed="${i === 0}">${inline(p.label)}</button>`).join('');
      const bodies = panes.map((p, i) => `<div class="switch-pane" data-pane="${i}"${i ? ' hidden' : ''}>${marked.parse(p.lines.join('\n'))}</div>`).join('');
      return `<div class="switch-box" id="${id}" data-switch><div class="switch-bar">${t.arg ? `<span class="seg-label">${inline(t.arg)}</span>` : ''}<span class="seg" role="group">${buttons}</span></div>${bodies}</div>\n`;
    },
    // A subsection only some readers need (测试要点): folded by default, the summary says how many rows it holds.
    fold(t) {
      const tokens = marked.lexer(t.body);
      const table = tokens.find(x => x.type === 'table');
      const list = tokens.find(x => x.type === 'list');
      const n = table ? table.rows.length : list ? list.items.length : 0;
      return `<details class="fold"><summary><span class="fold-t">${inline(t.arg || '展开')}</span>${n ? `<span class="fold-n">${n} 条</span>` : ''}</summary><div class="fold-b">${marked.parse(t.body)}</div></details>\n`;
    },
    // A prototype page: the stage is drawn by the frame script, the notes come from this block.
    proto(t) {
      const [id, title = '', kindLabel = '新增页面'] = t.arg.split(/\s*\|\s*/);
      const pageKind = /改动|修改/.test(kindLabel) ? 'chg' : 'new';
      const lines = t.body.split('\n');
      const before = lines.filter(l => /^>\s?/.test(l)).map(l => l.replace(/^>\s?/, '')).join(' ').trim();
      const lede = lines.filter(l => l.trim() && !/^\s*(>|\d+\.\s|[-*]\s|\s{2,})/.test(l)).join(' ').trim();
      const func = listItems(t.body, /^(\d+)\.\s+(.*)$/).map(({ head, text }) => {
        const n = head[1];
        let kind = pageKind;
        const b = /^【([^】]+)】\s*/.exec(text);
        if (b && BADGES[b[1]] && NOTE_KIND[BADGES[b[1]]]) kind = NOTE_KIND[BADGES[b[1]]];
        const body = b && BADGES[b[1]] && NOTE_KIND[BADGES[b[1]]] ? text.slice(b[0].length) : text;
        const nid = `${id}-${n}`;
        state.links.set(nid, nid);
        state.ids.add(nid);
        return `<li data-n="${n}" id="${nid}" class="n-${kind}"><span class="pn">${n}</span><span>${block(body)}</span></li>`;
      }).join('');
      const change = listItems(t.body).map(({ text }) => `<li class="n-chg"><span class="pn pn-dot"></span><span>${block(text)}</span></li>`).join('');
      state.ids.add(id);
      state.links.set(id, id);
      state.titles[id] = `${id} ${title}`;
      state.toc.push({ depth: 3, id, num: id, title });
      state.protos.push(id);
      const tag = pageKind === 'new' ? '<span class="b b-new">新增页面</span>' : '<span class="b b-mod">改动页面</span>';
      return `<section class="spec" id="${id}" data-frame="${id}" data-kind="${pageKind}">
<div class="spec-head"><div><h3><span class="fid">${esc(id)}</span>${inline(title)}${tag}</h3>${lede ? `<p>${inline(lede)}</p>` : ''}</div><div class="spec-tools"></div></div>
<div class="spec-body"><div class="stagebox"><div class="stage-caption"><span class="cap-text"></span><span>共 <span data-pin-count>0</span> 处编号，点击查看说明</span></div><div class="stage"><div class="stage-inner"><div class="stage-fallback">原型需要浏览器脚本才能显示</div></div></div></div>
<aside class="notes" aria-label="${esc(title)}的说明"><div class="notes-tabs" role="tablist"><button type="button" role="tab" data-tab="func" aria-selected="true">功能说明</button><button type="button" role="tab" data-tab="change" aria-selected="false">改动说明</button></div>
<div class="notes-body"><div class="notes-pane" data-pane="func"><ol>${func}</ol></div>
<div class="notes-pane" data-pane="change" hidden>${before ? `<div class="before">${inline(before)}</div>` : ''}<div class="nhead">实现要点</div><ol>${change}</ol></div></div></aside></div>
</section>\n`;
    },
  };

  marked.use({
    extensions: [
      {
        name: 'container',
        level: 'block',
        start(src) { const i = src.search(/^::: ?[\w-]+/m); return i < 0 ? undefined : i; },
        tokenizer(src) {
          const m = /^::: ?([\w-]+)[ \t]*([^\n]*)\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
          if (!m) return undefined;
          const token = { type: 'container', raw: m[0], kind: m[1], arg: m[2].trim(), body: m[3], tokens: [] };
          if (!containers[token.kind]) this.lexer.blockTokens(token.body, token.tokens);
          return token;
        },
        renderer(t) {
          if (containers[t.kind]) return containers[t.kind](t);
          const callout = /^callout-(\w+)$/.exec(t.kind);
          if (callout) {
            const [cls, fallback] = CALLOUTS[callout[1].toUpperCase()];
            return `<div class="callout c-${cls}">${ICONS[cls]}<div class="ct">${inline(t.arg || fallback)}</div><div class="cb">${this.parser.parse(t.tokens)}</div></div>\n`;
          }
          state.warnings.push(`unknown container ::: ${t.kind}`);
          return this.parser.parse(t.tokens);
        },
      },
      {
        name: 'badge',
        level: 'inline',
        start(src) { const i = src.indexOf('【'); return i < 0 ? undefined : i; },
        tokenizer(src) {
          const m = /^【([^】\n]{1,6})】/.exec(src);
          if (m && BADGES[m[1]]) return { type: 'badge', raw: m[0], text: m[1] };
          return undefined;
        },
        renderer(t) { return `<span class="b b-${BADGES[t.text]}">${t.text}</span>`; },
      },
      {
        name: 'secref',
        level: 'inline',
        start(src) { const i = src.indexOf('§'); return i < 0 ? undefined : i; },
        tokenizer(src) {
          const m = /^§(\d+(?:\.\d+)*|附录\s?[A-Z])/.exec(src);
          if (m) return { type: 'secref', raw: m[0], ref: m[1].replace(/\s/, ' ') };
          return undefined;
        },
        // Resolved once every view is parsed: this view's section first, then the same number in another view.
        renderer(t) {
          const num = t.ref.replace(' ', '');
          state.refs.add(num);
          return `<a class="xref" data-sec="${esc(num)}">${esc(t.ref)}</a>`;
        },
      },
    ],
    renderer: {
      heading({ tokens, depth, text }) {
        const raw = text.trim();
        const m = /^(附录(?:\s?[A-Z])?|\d+(?:\.\d+)*)(?:\s+(.*))?$/.exec(raw);
        let num = null, title = raw;
        if (m && depth <= 3) { num = m[1].replace(/\s/, ''); title = (m[2] || '').trim(); }
        const inner = num ? inline(title) : this.parser.parseInline(tokens);
        const plain = title.replace(/【[^】]*】/g, '').replace(/[*`]/g, '').trim();
        const id = num ? sectionId(num, state.prefix) : state.prefix + 'h-' + (++state.autoId);
        state.ids.add(id);
        if (depth === 2 || depth === 3) state.toc.push({ depth, id, num, title: plain });
        if (num) state.titles[id] = (num.startsWith('附录') ? num + ' ' : num + ' ') + plain;
        if (depth === 2) {
          const label = !num ? '' : num === '附录' ? '附录' : num === '0' ? '总览' : `第${CN_NUM[+num] || num}章`;
          return `<div class="sec-head">${label ? `<span class="sec-no">${label}</span>` : ''}<h2 id="${id}">${inner}</h2></div>\n`;
        }
        const chip = num ? `<span class="n">${esc(num.replace(/^附录/, ''))}</span>` : '';
        return `<h${depth} id="${id}">${chip}${inner}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const info = (lang || '').trim();
        const language = info.split(/\s+/)[0].toLowerCase();
        if (language === 'mermaid') {
          const caption = (/title="([^"]*)"/.exec(info) || [])[1] || '';
          state.diagrams.push({ def: text, caption });
          return `<!--DIAGRAM:${state.diagrams.length - 1}-->\n`;
        }
        if (!language || language === 'text' || language === 'plaintext') {
          const cls = /\[[a-z][a-z0-9-]{1,30}\]\s+\S+\.[a-z]{2,10}/.test(text) ? 'chain' : 'plain';
          return `<pre class="${cls}"><code>${cls === 'chain' ? highlightChain(text) : esc(text)}</code></pre>\n`;
        }
        const body = hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : esc(text);
        return `<pre class="code" data-lang="${esc(language)}"><code>${body}</code></pre>\n`;
      },
      codespan({ text }) {
        const ref = /^\[([a-z][a-z0-9-]{1,30})\]\s+(.+)$/.exec(text);
        let html = esc(ref ? ref[2] : text);
        // Long identifiers may wrap at camelCase boundaries; line numbers such as :374-404 never break.
        html = html.replace(/[A-Za-z][A-Za-z0-9]{19,}/g, w => w.replace(/(?<=[a-z0-9])(?=[A-Z])/g, '<wbr>'));
        html = html.replace(/:\d+(?:-\d+)?/g, m => `<span class="ln">${m}</span>`);
        // Paths may wrap after a slash.
        if (/\/[^/]+\//.test(text)) html = html.replace(/\//g, '/<wbr>');
        return ref ? `<code class="ref"><span class="repo">${ref[1]}</span>${html}</code>` : `<code>${html}</code>`;
      },
    },
  });
  return marked;
}

const ICONS = {
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>',
  tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>',
  important: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 16.5h.01"/></svg>',
  caution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2Z"/><path d="M12 8v4.5"/><path d="M12 16h.01"/></svg>',
};

// Wrap tables and anchor rows whose first cell is an ID (B1, D10, PM-3); the IDs become link targets.
function anchorRows(html, state) {
  html = html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');
  return html.replace(/<tr>\s*<td([^>]*)>(?:<strong>)?([A-Z]{1,4}-?\d{1,2})(?:<\/strong>)?<\/td>/g, (all, attrs, id) => {
    if (!ID_PATTERN.test(id)) return all;
    const rowId = state.prefix + 'id-' + id;
    if (state.ids.has(rowId)) state.warnings.push(`duplicate row id ${id}`);
    state.ids.add(rowId);
    state.links.set(id, rowId);
    return `<tr id="${rowId}">\n<td${attrs} class="idc"><span class="rid">${id}</span></td>`;
  });
}

// Link IDs in the text (B1, P1-3, 决策 2) to their targets, which may sit in another view.
function autolink(html, state, links) {
  if (!links.size) return html;
  const ids = [...links.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/[-]/g, '\\-'));
  const re = new RegExp(`(?<![A-Za-z0-9_\\-#])(${ids.join('|')})(?![A-Za-z0-9_]|-\\d)`, 'g');
  const skip = new Set(['a', 'code', 'pre', 'svg', 'script', 'style', 'h1', 'h2', 'h3', 'title', 'summary', 'button']);
  let depth = 0, ridDepth = 0;
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) {
      const t = /^<(\/)?([a-zA-Z0-9]+)/.exec(part);
      if (t && skip.has(t[2].toLowerCase()) && !part.endsWith('/>')) depth += t[1] ? -1 : 1;
      if (/^<span class="(rid|fid|dn)">/.test(part)) ridDepth = 1;
      else if (ridDepth && part === '</span>') ridDepth = 0;
      return part;
    }
    if (depth > 0 || ridDepth) return part;
    return part.replace(re, id => {
      const target = links.get(id);
      const href = target.includes('#') ? target : '#' + target;
      const title = state.titles[id] || state.titles[target];
      return `<a class="idref${id.startsWith('决策') ? ' dref' : ''}" href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}>${id}</a>`;
    });
  }).join('');
}

function legendFor(def) {
  const used = Object.keys(LEGEND).filter(k => new RegExp(`:::${k}\\b|^\\s*class\\s+[^\\n]*\\b${k}\\s*$`, 'm').test(def));
  if (NEW_RECT.test(def) && !used.includes('new')) used.unshift('new');
  return used.map(k => `<span class="lg lg-${k}"><i></i>${LEGEND[k]}</span>`).join('');
}

// The diagram keyword, skipping front matter and %% lines.
function diagramKind(def) {
  const lines = def.split('\n');
  let i = 0;
  if (/^---\s*$/.test(lines[0] || '')) { i = 1; while (i < lines.length && !/^---\s*$/.test(lines[i])) i++; i++; }
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l && !l.startsWith('%%')) return l.split(/\s/)[0];
  }
  return '';
}

// mermaid.json holds the shared theme; "x-flowchart" adds flowchart-only settings (the ELK layout).
function configFor(kind, base) {
  const { 'x-flowchart': flow, ...cfg } = base;
  return (kind === 'flowchart' || kind === 'graph') && flow ? { ...cfg, ...flow } : cfg;
}

// The diagram rules in references/diagrams.md that a script can check. They print warnings; the build still succeeds.
const textWidth = s => [...s].reduce((n, ch) => n + (/[\u2e80-\uffef]/.test(ch) ? 1 : 0.55), 0);
function lintDiagram(d, n) {
  const where = `diagram ${n}${d.caption ? `「${d.caption}」` : ''}`;
  const kind = diagramKind(d.def);
  const strip = v => v.replace(/<br\s*\/?>/gi, '\n').replace(/["`]/g, '').trim();
  const out = [];
  if (kind === 'sequenceDiagram') {
    d.def.split('\n').forEach((l, i) => {
      const self = /^\s*([\w\u4e00-\u9fff]+)\s*-{1,2}[>)x]{1,2}[+-]?\s*\1\s*:/.exec(l);
      if (self) out.push(`${where} line ${i + 1}: 自调用的文字会压在编号和连线上，改成 Note right of ${self[1]}: …`);
      const p = /^\s*(?:participant|actor)\s+\S+\s+as\s+(.+)$/.exec(l);
      if (p && strip(p[1]).split('\n').some(seg => textWidth(seg) > 14)) out.push(`${where} line ${i + 1}: 参与者名称每行不超过 14 个字；类名用 <br/> 另起一行，或写进图解`);
      const msg = /^\s*[^\s:]+\s*-{1,2}[>)x]{1,2}[+-]?\s*[^\s:]+\s*:\s*(.+)$/.exec(l);
      if (msg && !self && textWidth(strip(msg[1])) > 26) out.push(`${where} line ${i + 1}: 消息文字不超过 26 个字，细节写进图解`);
    });
  } else if (kind === 'flowchart' || kind === 'graph') {
    for (const m of d.def.matchAll(/[A-Za-z_]\w*\s*\{(?!\{)([^{}]+)\}/g)) {
      const q = strip(m[1]).replace(/\n/g, '');
      if (textWidth(q) > 12) out.push(`${where}: 判断节点「${q.slice(0, 16)}…」只写一个短问题（不超过 12 个字），条件写在连线上`);
    }
    const nodes = new Set([...d.def.matchAll(/(?:^|[\s;&>|-])([A-Za-z_]\w*)\s*(?:\[|\(|\{|>)/gm)].map(m => m[1]));
    if (nodes.size > 20) out.push(`${where}: ${nodes.size} 个节点，超过 20 个时按阶段拆成几张图`);
  } else if (kind === 'mindmap') {
    out.push(`${where}: 思维导图的放射布局不好读，改用 ::: board（分组看板）`);
  } else if (kind === 'erDiagram') {
    if ((d.def.match(/^\s+[\w()]+\s+\w+/gm) || []).length > 12) out.push(`${where}: ER 图只画表之间的关系，字段写进「数据模型」的表格`);
  }
  return out;
}

function prepareDiagram(def) {
  const kind = diagramKind(def);
  if (kind === 'flowchart' || kind === 'graph') {
    const extra = Object.entries(CLASS_DEFS)
      .filter(([k]) => new RegExp(`:::${k}\\b|^\\s*class\\s+[^\\n]*\\b${k}\\b`, 'm').test(def) && !new RegExp(`classDef\\s+${k}\\b`).test(def))
      .map(([k, v]) => `    classDef ${k} ${v}`);
    return def.trimEnd() + (extra.length ? '\n' + extra.join('\n') : '') + '\n';
  }
  return def;
}

function postprocessSvg(svg, id) {
  svg = svg.replace(/^\s*<\?xml[^>]*>\s*/, '');
  const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(svg);
  if (vb) {
    const minWidth = Math.ceil(parseFloat(vb[1]) * MIN_SCALE);
    svg = svg.replace(/style="max-width:\s*([\d.]+)px;?([^"]*)"/, (m, max, rest) => `style="min-width:${Math.min(minWidth, Math.ceil(parseFloat(max)))}px;max-width:${max}px;${rest.trim()}"`);
  }
  // Participant labels on several lines: mermaid spaces lines at the font size; widen to 18px.
  svg = svg.replace(/(class="actor actor-box"[^>]*><tspan[^>]*? dy=")(-?[\d.]+)"/g, (m, head, dy) => `${head}${+(parseFloat(dy) * 18 / 14).toFixed(2)}"`);
  // A block of new steps (rect rgba(107, 78, 255, …)) gets a dashed purple frame, so it reads as one unit.
  svg = svg.replace(/<rect([^>]*?)fill="rgba\(107, ?78, ?255, ?[\d.]+\)"([^>]*?)class="rect"\s*\/>/g,
    (m, a, b) => `<rect${a}fill="rgba(107, 78, 255, 0.06)" stroke="#8b74ff" stroke-width="1.25" stroke-dasharray="6 4" rx="10" ry="10"${b}class="rect dg-newstep"/>`);
  // Participants whose name says 新增 / 改动 / 三方 take the same colors as flowchart nodes.
  svg = svg.replace(/(<g[^>]*data-et="participant"[^>]*>\s*<rect)([^>]*class="actor actor-(?:top|bottom)")([^>]*\/>\s*<text[^>]*>)([\s\S]*?)(<\/text>)/g, (m, open, attrs, mid, label, close) => {
    const name = label.replace(/<[^>]+>/g, '');
    const style = /新增/.test(name) ? 'fill:#f3f0ff;stroke:#6b4eff;stroke-width:1.75px'
      : /改动|修改/.test(name) ? 'fill:#fff7e6;stroke:#e09a2b;stroke-width:1.75px'
      : /三方|外部/.test(name) ? 'fill:#ffffff;stroke:#64748b;stroke-dasharray:5 4' : '';
    return style ? `${open} style="${style}"${attrs}${mid}${label}${close}` : m;
  });
  return svg.replace('<svg ', `<svg data-dg="${id}" `);
}

async function renderDiagrams(diagrams, mermaidConfig) {
  if (!diagrams.length) return { svgs: [], hits: 0 };
  fs.mkdirSync(CACHE, { recursive: true });
  const jobs = diagrams.map((d, i) => {
    const def = prepareDiagram(d.def);
    const config = configFor(diagramKind(def), mermaidConfig);
    const hash = crypto.createHash('sha256').update(JSON.stringify(config)).update('\0').update(def).digest('hex').slice(0, 16);
    return { i, def, config, hash, file: path.join(CACHE, hash + '.svg') };
  });
  const missing = jobs.filter(j => !fs.existsSync(j.file));
  if (missing.length) {
    const [{ default: puppeteer }, { renderMermaid }] = await Promise.all([import('puppeteer'), import('@mermaid-js/mermaid-cli')]);
    const browser = await puppeteer.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
    try {
      for (const j of missing) {
        try {
          const { data } = await renderMermaid(browser, j.def, 'svg', { backgroundColor: 'transparent', mermaidConfig: j.config, svgId: 'dg-' + j.hash });
          fs.writeFileSync(j.file, Buffer.from(data));
        } catch (e) {
          throw new Error(`diagram ${j.i + 1} failed to render: ${e.message}\n${j.def}`);
        }
      }
    } finally {
      await browser.close();
    }
  }
  return { svgs: jobs.map(j => postprocessSvg(fs.readFileSync(j.file, 'utf8'), j.hash)), hits: jobs.length - missing.length };
}

function renderHero(meta, inline, heroId, label) {
  const status = meta.status ? `<span class="chip chip-status ${STATUS[meta.status] || 'st-draft'}">${esc(meta.status)}</span>` : '';
  const plain = [meta.version, meta.date].filter(Boolean).map(v => `<span class="chip chip-plain">${esc(v)}</span>`).join('');
  const rows = (Array.isArray(meta.meta) ? meta.meta : []).map(item => {
    const [k, ...v] = item.split(/[:：]\s*/);
    return `<dt>${esc(k)}</dt><dd>${inline(v.join('：'))}</dd>`;
  }).join('');
  const readers = (Array.isArray(meta.readers) ? meta.readers : []).map(item => {
    const [who, ...what] = item.split(/[:：]\s*/);
    return `<div><div class="who"><span class="b b-${BADGES[who] || 'keep'}">${esc(who)}</span></div>${inline(what.join('：'))}</div>`;
  }).join('');
  return `<header class="hero" id="${heroId}">
<div class="hero-grid"><div>
<div class="hero-top">${label || meta.doctype ? `<span class="chip chip-type">${esc(label || meta.doctype)}</span>` : ''}${status}${plain}</div>
<h1>${esc(meta.title || '')}</h1>
${meta.summary ? `<p class="lede">${inline(meta.summary)}</p>` : ''}
</div>${rows ? `<dl class="hero-meta">${rows}</dl>` : ''}</div>
${readers ? `<div class="readers">${readers}</div>` : ''}
</header>`;
}

function renderToc(toc) {
  return toc.map(e => {
    const n = e.num ? (e.num === '附录' ? '' : e.num.replace(/^附录/, '')) : '';
    return `<a class="l${e.depth}" href="#${e.id}"><span class="tn">${esc(n)}</span><span>${esc(e.title)}</span></a>`;
  }).join('\n');
}

const VIEWS = { req: '需求设计', proto: '原型交互', design: '技术方案', decision: '决策记录' };
// Each view: the doctype that selects it, its file name prefix, the front matter key other docs use to
// point at it, and the prefix of its element IDs.
const ROLES = {
  req: { doctype: ['需求设计', '需求分析'], file: '【需求设计】', key: 'requirement', id: 'q-' },
  proto: { doctype: ['功能原型', '原型交互'], file: '【功能原型】', key: 'prototype', id: 'p-' },
  design: { doctype: ['技术方案', '设计方案'], file: '【技术文档】', key: 'design', id: '' },
  decision: { doctype: ['决策记录'], file: '【决策记录】', key: 'decisions', id: 'r-' },
};
// IDs a view lends to other views: prototype pages and notes, decisions, and the row IDs of the requirement
// design and the technical design. A view links its own rows first, then the views listed in IMPORTS, in order.
const EXPORTS = {
  req: id => ID_PATTERN.test(id),
  proto: id => /^P\d+(?:-\d+)?$/.test(id),
  decision: id => /^决策 \d+$/.test(id),
  design: id => ID_PATTERN.test(id),
};
const IMPORTS = { req: ['proto', 'decision', 'design'], proto: ['req', 'decision'], design: ['req', 'proto', 'decision'], decision: ['req', 'proto', 'design'] };

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(HOME, 'config.json'), 'utf8')); } catch { return {}; }
}

// A product skin is looked up next to the doc, then in the local profile, then in the skill.
function findSkin(name, docDir) {
  for (const dir of [path.join(docDir, 'skins'), path.join(HOME, 'skins'), path.join(ASSETS, 'skins')]) {
    if (fs.existsSync(path.join(dir, name + '.css')) && fs.existsSync(path.join(dir, name + '.js'))) return dir;
  }
  throw new Error(`skin "${name}" not found in ./skins, ${path.join(HOME, 'skins')} or ${path.join(ASSETS, 'skins')}`);
}

function loadDoc(file, role) {
  const [meta, body] = parseFrontMatter(fs.readFileSync(file, 'utf8'));
  return { file, meta, body, role: role || Object.keys(ROLES).find(r => ROLES[r].doctype.includes(meta.doctype)) || 'design' };
}

// The rest of the series: front matter first (prototype: / design: / decisions:), then sibling file names.
function findFamily(doc) {
  const found = {};
  const base = path.basename(doc.file);
  const own = ROLES[doc.role].file;
  for (const [role, r] of Object.entries(ROLES)) {
    if (role === doc.role) continue;
    const file = doc.meta[r.key] ? path.resolve(path.dirname(doc.file), doc.meta[r.key])
      : base.startsWith(own) ? path.join(path.dirname(doc.file), r.file + base.slice(own.length)) : null;
    if (file && fs.existsSync(file)) found[role] = file;
  }
  return found;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const first = loadDoc(path.resolve(args.input));
  const docs = { [first.role]: first };
  for (const [role, file] of Object.entries(findFamily(first))) docs[role] = loadDoc(file, role);
  // Owners outside the team (三方 platforms) become badges: config.json "parties" and front matter "parties:".
  const config = readConfig();
  const list = v => (Array.isArray(v) ? v : v ? String(v).split(/[,，、\s]+/) : []);
  for (const name of [config.parties, ...Object.values(docs).map(d => d.meta.parties)].flatMap(list)) if (name && !BADGES[name]) BADGES[name] = 'ext';
  const shared = { ids: new Set(), titles: {}, diagrams: [], warnings: [] };
  const views = [];
  for (const role of Object.keys(VIEWS)) {
    const doc = docs[role];
    if (!doc) continue;
    const heroId = 'top-' + role;
    shared.ids.add(heroId);
    const state = { prefix: ROLES[role].id, role, toc: [], ids: shared.ids, refs: new Set(), links: new Map(), titles: shared.titles, diagrams: shared.diagrams, protos: [], warnings: shared.warnings, autoId: 0 };
    const marked = createMarked(state);
    const html = anchorRows(marked.parse(preprocess(doc.body)), state);
    views.push({ role, doc, state, marked, heroId, html, missing: [] });
  }
  // With every view parsed, IDs and § references resolve in their own view first, then across views.
  const byRole = r => views.find(v => v.role === r);
  for (const v of views) {
    const links = new Map(v.state.links);
    for (const other of IMPORTS[v.role].map(byRole).filter(Boolean)) {
      for (const [k, target] of other.state.links) if (EXPORTS[other.role](k) && !links.has(k)) links.set(k, target);
    }
    v.html = autolink(v.html, v.state, links);
    const order = [v, ...['design', 'req', 'proto', 'decision'].map(byRole).filter(x => x && x !== v)];
    v.resolve = html => html.replace(/<a class="xref" data-sec="([^"]+)">/g, (m, num) => {
      const id = order.map(x => sectionId(num, x.state.prefix)).find(x => shared.ids.has(x));
      if (!id) { v.missing.push(num); return '<a class="xref">'; }
      return `<a class="xref" href="#${id}"${shared.titles[id] ? ` title="${esc(shared.titles[id])}"` : ''}>`;
    });
    v.html = v.resolve(v.html);
  }

  shared.diagrams.forEach((d, i) => shared.warnings.push(...lintDiagram(d, i + 1)));
  const mermaidConfig = JSON.parse(fs.readFileSync(path.join(ASSETS, 'mermaid.json'), 'utf8'));
  const { svgs, hits } = await renderDiagrams(shared.diagrams, mermaidConfig);
  for (const v of views) {
    v.html = v.html.replace(/<!--DIAGRAM:(\d+)-->/g, (m, i) => {
      const d = shared.diagrams[+i];
      const legend = legendFor(d.def);
      const caption = d.caption ? `<span class="cap">${esc(d.caption)}</span>` : '';
      return `<figure class="dg">${svgs[+i]}${caption || legend ? `<figcaption>${caption}${legend}</figcaption>` : ''}</figure>`;
    });
  }

  // Prototype pages need the runtime, a product skin and the prototype's frame script.
  let css = fs.readFileSync(path.join(ASSETS, 'doc.css'), 'utf8');
  let js = fs.readFileSync(path.join(ASSETS, 'doc.js'), 'utf8');
  const protoView = views.find(v => v.state.protos.length);
  if (protoView) {
    const { meta, file } = protoView.doc;
    const framesPath = meta.proto ? path.resolve(path.dirname(file), meta.proto) : file.replace(/\.md$/i, '.proto.js');
    if (!fs.existsSync(framesPath)) throw new Error(`prototype frames not found: ${framesPath}`);
    const skin = meta.skin || config.skin || 'admin';
    const skinDir = findSkin(skin, path.dirname(file));
    css += '\n' + fs.readFileSync(path.join(ASSETS, 'proto.css'), 'utf8') + '\n' + fs.readFileSync(path.join(skinDir, `${skin}.css`), 'utf8');
    js += '\n' + fs.readFileSync(path.join(ASSETS, 'proto.js'), 'utf8') + '\n' + fs.readFileSync(path.join(skinDir, `${skin}.js`), 'utf8')
      + '\n' + fs.readFileSync(framesPath, 'utf8') + '\nwindow.PROTO && PROTO.init();\n';
  }

  const title = first.meta.title || path.basename(first.file, '.md').replace(/^【[^】]+】/, '');
  const output = path.resolve(args.output || (first.meta.output ? path.resolve(path.dirname(first.file), first.meta.output) : path.join(path.dirname(first.file), `【设计文档】${title}.html`)));
  const active = views[0].role;
  const buttons = Object.entries(VIEWS).map(([role, label]) => {
    const has = views.some(v => v.role === role);
    return `<button type="button" data-view-btn="${role}" aria-pressed="${role === active}"${has ? '' : ' disabled title="还没有写"'}>${label}</button>`;
  }).join('');
  const tocs = views.map(v => `<nav class="toc" data-view="${v.role}" aria-label="${VIEWS[v.role]}目录"${v.role === active ? '' : ' hidden'}>\n${renderToc(v.state.toc)}\n</nav>`).join('\n');
  const content = views.map(v => {
    const inline = s => v.marked.parseInline(s);
    return `<section class="view" data-view="${v.role}"${v.role === active ? '' : ' hidden'}>\n${v.resolve(renderHero(v.doc.meta, inline, v.heroId, VIEWS[v.role]))}\n${v.html}\n</section>`;
  }).join('\n');
  // A link to a view that does not exist yet becomes plain text.
  let html = content;
  for (const role of Object.keys(VIEWS)) {
    if (!views.some(v => v.role === role)) html = html.replace(new RegExp(`<a href="#top-${role}">([^<]*)</a>`, 'g'), '<span class="pending-link">$1（还没有写）</span>');
  }
  const page = fs.readFileSync(path.join(ASSETS, 'shell.html'), 'utf8');
  const fill = { title: esc(title), css, js, tocs, buttons, content: html };
  const out = page.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : m));
  fs.writeFileSync(output, out);

  console.log(`output: ${output} (${Math.round(Buffer.byteLength(out) / 1024)} KB)`);
  for (const v of views) {
    console.log(`${VIEWS[v.role]}: ${path.basename(v.doc.file)}; ${v.state.toc.filter(e => e.depth === 2).length} chapters, ${v.state.toc.filter(e => e.depth === 3).length} subsections${v.state.protos.length ? `, ${v.state.protos.length} prototype pages` : ''}`);
    if (v.missing.length) { console.log(`  missing section refs: ${[...new Set(v.missing)].map(n => '§' + n).join(', ')}`); process.exitCode = 1; }
  }
  for (const [role, label] of Object.entries(VIEWS)) if (!docs[role]) console.log(`${label}: none yet`);
  console.log(`diagrams: ${shared.diagrams.length} (${hits} cached)`);
  for (const w of shared.warnings) console.log('warning: ' + w);
}

main().catch(e => { console.error(e.message); process.exit(1); });
