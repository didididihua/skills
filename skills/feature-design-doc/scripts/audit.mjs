#!/usr/bin/env node
// Check a built doc in Chrome, view by view: layout overflow, font sizes, diagram text size and overlaps,
// tall diagrams, anchors, script errors.
// Usage: node audit.mjs <doc.html> [--widths 1440,1024,900] [--shots <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const file = path.resolve(args[0]);
const opt = (name, fallback) => { const i = args.indexOf(name); return i > 0 ? args[i + 1] : fallback; };
const widths = opt('--widths', '1440,1024,900').split(',').map(Number);
const shots = opt('--shots', null);

const browser = await puppeteer.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let failed = false;

for (const width of widths) {
 await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
 await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
 const views = await page.evaluate(() => [...document.querySelectorAll('[data-view-btn]:not([disabled])')].map(b => b.dataset.viewBtn));
 for (const view of views.length ? views : ['page']) {
  if (view !== 'page') {
    await page.evaluate(v => document.querySelector(`[data-view-btn="${v}"]`).click(), view);
    await new Promise(r => setTimeout(r, 150));
  }
  const r = await page.evaluate(() => {
    const sizes = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest('svg, script, style')) continue;
      if (el.getClientRects().length === 0) continue;
      const fs = getComputedStyle(el).fontSize;
      sizes[fs] = (sizes[fs] || 0) + 1;
    }
    let minDiagram = 99, minDiagramId = '';
    document.querySelectorAll('figure.dg svg').forEach(svg => {
      const vb = svg.viewBox.baseVal;
      if (!vb || !vb.width) return;
      const w = svg.getBoundingClientRect().width;
      if (!w) return;
      const scale = w / vb.width;
      svg.querySelectorAll('text:not(.sequenceNumber), foreignObject div, foreignObject span, foreignObject p').forEach(t => {
        if (!t.textContent.trim()) return;
        const f = parseFloat(getComputedStyle(t).fontSize) * scale;
        if (f && f < minDiagram) { minDiagram = f; minDiagramId = svg.dataset.dg || svg.id; }
      });
    });
    // Text that overlaps other text inside a diagram: labels on self-calls, crowded edge labels, long node text.
    const overlaps = [], tall = [];
    document.querySelectorAll('figure.dg').forEach(fig => {
      if (!fig.getClientRects().length) return;
      const h = fig.getBoundingClientRect().height;
      if (h > 1600) tall.push(`${fig.querySelector('svg')?.dataset.dg || fig.className} ${Math.round(h)}px`);
      const svg = fig.querySelector('svg');
      if (!svg) return;
      const boxes = [...svg.querySelectorAll('text, foreignObject div')]
        .filter(t => t.textContent.trim() && !t.querySelector('text, div'))
        .map(t => ({ r: t.getBoundingClientRect(), s: t.textContent.trim() }))
        .filter(b => b.r.width && b.r.height);
      let n = 0, sample = '';
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3) {
          n++;
          if (!sample) sample = ` 「${boxes[i].s.slice(0, 14)}」×「${boxes[j].s.slice(0, 14)}」`;
        }
      }
      if (n) overlaps.push(`${svg.dataset.dg || svg.id}: ${n}${sample}`);
    });
    const overflow = sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1)
      .map(e => (e.closest('[id]')?.id || e.className) + ' +' + (e.scrollWidth - e.clientWidth) + 'px');
    const ids = new Set([...document.querySelectorAll('[id]')].map(e => e.id));
    return {
      nav: getComputedStyle(document.querySelector('.toc:not([hidden])')).flexDirection === 'column' ? 'sidebar' : 'topbar',
      content: Math.round(document.querySelector('.page').getBoundingClientRect().width),
      view: document.documentElement.dataset.view,
      fontSizes: Object.entries(sizes).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, v]) => `${k}×${v}`).join(' '),
      minDiagramText: minDiagram === 99 ? null : `${minDiagram.toFixed(1)}px (${minDiagramId})`,
      diagramOverlaps: overlaps,
      tallDiagrams: tall,
      scrollingFigures: overflow('figure.dg'),
      scrollingTables: overflow('.tbl'),
      scrollingCode: overflow('pre'),
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(id => id && !ids.has(id)),
      height: document.documentElement.scrollHeight,
    };
  });
  if (r.pageOverflow || r.brokenAnchors.length || r.diagramOverlaps.length) failed = true;
  console.log(`\n== ${width}px ${view}`);
  for (const [k, v] of Object.entries(r)) console.log(`${k}: ${Array.isArray(v) ? (v.length ? v.join(', ') : '-') : v}`);
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    const tiles = Math.ceil(r.height / 900);
    for (let i = 0; i < tiles; i++) {
      const out = path.join(shots, `w${width}-${view}-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: out, clip: { x: 0, y: i * 900, width, height: Math.min(900, r.height - i * 900) }, captureBeyondViewport: true });
    }
    console.log(`shots: ${tiles} tiles in ${shots}`);
  }
 }
}
console.log(`\nscript errors: ${errors.length ? errors.join(' | ') : '-'}`);
await browser.close();
if (failed || errors.length) process.exitCode = 1;
