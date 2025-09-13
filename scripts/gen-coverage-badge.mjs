import fs from 'node:fs';
import path from 'node:path';

function toBadge(pct) {
  const color = pct >= 90 ? '#4c1' : pct >= 80 ? '#97CA00' : pct >= 70 ? '#a4a61d' : '#dfb317';
  const label = 'coverage';
  const value = `${pct}%`;
  const width = 90;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a"><rect width="${width}" height="20" rx="3" fill="#fff"/></mask>
  <g mask="url(#a)">
    <rect width="55" height="20" fill="#555"/>
    <rect x="55" width="${width-55}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="28" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="28" y="14">${label}</text>
    <text x="${55 + (width-55)/2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${55 + (width-55)/2}" y="14">${value}</text>
  </g>
</svg>`;
}

function genBadgeFor(dir) {
  const summaryPath = path.join(dir, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) return false;
  const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const pct = Math.round((data.total.lines.pct || 0));
  const svg = toBadge(pct);
  const out = path.join(dir, 'coverage', 'badge.svg');
  fs.writeFileSync(out, svg, 'utf-8');
  return true;
}

const roots = process.argv.slice(2);
for (const r of roots) {
  genBadgeFor(r);
}
