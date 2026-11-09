// Renders og.html (dev server on :5174) to public/og.jpg at 1200×630 with headless Edge or Chrome.
// JPEG, not PNG: the card holds a photo, and WhatsApp skips preview images over about 300 KB.
// Usage: node scripts/og.mjs   — run after changing the card or the scene.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const browsers = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const exe = browsers.find((b) => existsSync(b));
if (!exe) throw new Error('No Chrome/Edge found; set BROWSER to its path.');

const out = resolve('public/og.jpg');
execFileSync(exe, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1200,630', '--virtual-time-budget=4000',
  `--screenshot=${out}`, process.env.OG_URL ?? 'http://localhost:5174/og.html',
], { stdio: 'inherit' });
console.log('wrote', out);
