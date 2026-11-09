// The JD compiler: job description in, fit report out. Pure functions, no DOM, no network.
// Lex: find every known skill in the text. Parse: work out which section and clause each one sits in,
// so "nice to have" and "Java or Go" mean what they say. Link: resolve each requirement against the
// symbol table. Emit: a weighted fit score plus the logistics a recruiter checks first.
import { SYMBOLS, SYMBOL_INDEX, type Sym, type Where, type Kind } from '../data/skills';
import { experience } from '../data/career';

export type Priority = 'must' | 'role' | 'nice';
export type Status = 'match' | 'near' | 'miss';
export const WEIGHT: Record<Priority, number> = { must: 3, role: 2, nice: 1 };
const RANK: Record<Priority, number> = { must: 0, role: 1, nice: 2 };

export interface Req {
  key: string;
  /** What the JD asked for, in its own words where that reads better. */
  label: string;
  priority: Priority;
  status: Status;
  /** Matched through the résumé's skills list, not a project. */
  listed: boolean;
  credit: number;
  proof: string;
  where: Where[];
  /** The JD clause it came from. */
  quote: string;
  /** Offset of its first mention, for ordering. */
  at: number;
  /** Named in the job title: the role's core stack. */
  core: boolean;
}

export interface Span { start: number; end: number; req: number; }
export interface Note { label: string; tone: 'ok' | 'warn' | 'info'; text: string; }

export interface Report {
  text: string;
  title: string | null;
  words: number;
  sections: number;
  mentions: number;
  reqs: Req[];
  spans: Span[];
  notes: Note[];
  fit: number;
  /** Set when the title's core stack is missing and the score was capped. */
  cap: number | null;
  counts: Record<Status, number>;
  ms: number;
  stages: Stages;
}

/** What the lexer and parser produced, for the stage-by-stage view on the decisions page. */
export interface Stages {
  tokens: { word: string; sym: string; name: string; kind: Kind; at: number }[];
  /** Clauses that contain at least one skill, with the priority they were given and why. */
  clauses: { text: string; priority: Priority; why: string; skip: boolean; words: string[] }[];
}

export const MAX_CHARS = 20_000;

type Section = 'none' | 'must' | 'role' | 'nice' | 'skip';

const H_MUST = /^(?:requirements?|required(?: skills| experience| qualifications)?|must[- ]haves?|minimum (?:qualifications|requirements)|basic qualifications|qualifications|key skills|(?:technical |core |required )?skills(?: (?:and|&) (?:experience|qualifications))?|what you(?:'ll| will)? (?:need|bring)|what we(?:'re| are) looking for|who you are|about you|you (?:have|bring|should have)|you(?:'ll| will)? need|desired candidate profile|candidate profile|your (?:skills|experience|profile|background)|(?:the )?ideal candidate|experience(?: (?:and|&) skills)?|we(?:'re| are) looking for)$/;
const H_NICE = /^(?:nice[- ]to[- ]haves?|good[- ]to[- ]haves?|preferred(?: qualifications| skills| experience)?|bonus(?: points)?|pluses|desirable(?: skills)?|desired skills|additional (?:skills|qualifications)|it(?:'s| is| would be) (?:great|nice|a plus|a bonus) if(?: you(?: have)?)?|extra (?:credit|points)|even better(?: if)?|ideally(?: you(?: have)?)?)$/;
const H_ROLE = /^(?:responsibilities|key responsibilities|roles?(?: (?:and|&) responsibilities)?|what you(?:'ll| will) (?:do|work on|be doing)|the role|about the role|role overview|your role|in this role(?:,? you will)?|day[- ]to[- ]day|your impact|the job|job description|position (?:summary|overview)|overview|you will|your mission|the opportunity|(?:our |the )?tech(?:nology)? stack|our stack|stack)$/;
const H_SKIP = /^(?:about us|about the (?:company|team)|who we are|our (?:story|mission|culture|values|team|company)|why (?:join(?: us)?|work (?:with|for|at) us)|benefits|perks(?: (?:and|&) benefits)?|what we offer|we offer|compensation(?: (?:and|&) benefits)?|salary|pay|equal (?:employment )?opportunity|eeo(?: statement)?|diversity(?: (?:and|&) inclusion)?|how to apply|(?:our )?(?:interview|hiring) process|working (?:here|at [\w.]+)|life at [\w.]+|location|about [\w][\w&.' -]{0,40})$/;

const NICE_CUE = /\bnice[- ]to[- ]have\b|\bgood[- ]to[- ]have\b|\bpreferred\b|\bpreferably\b|\bbonus\b|\ba plus\b|\bdesirable\b|\bfamiliarity\b|\bexposure to\b|\bideally\b|\boptional\b|\bnot required\b|\bwould be great\b|\bnice if\b/;
const MUST_CUE = /\bmust\b|\brequired\b|\bmandatory\b|\bessential\b|\bstrong\b|\bexpert(?:ise)?\b|\bproficien(?:t|cy)\b|\bdeep\b|\bsolid\b|\bextensive\b|\bhands[- ]on\b|\bproven\b|\badvanced\b|\bin[- ]depth\b|\bexcellent\b/;
const CUE_ONLY = /^[\s(\-–—,:]*(?:(?:is|are|would be|will be)\s+)?(?:(?:a|an)\s+)?(?:(?:big|huge|strong|real)\s+)?(?:plus|bonus|preferred|nice[- ]to[- ]have|good[- ]to[- ]have|optional|desirable|required|mandatory|a must|must[- ]have|essential)[\s.!)]*$/;
const NEG_CUE = /\bno (?:prior |previous )?(?:[\w.+#-]+ ){0,4}(?:experience |knowledge )?(?:needed|required|necessary|expected)\b|\b(?:don't|do not) (?:need|have) to (?:know|have)\b|\bdon't need\b/;

const SEPARATOR = /^[\s,/&+]*(?:(?:and\/or|or|and|as well as|nor)(?:\s+(?:another|other|any|similar|equivalent|an?))?[\s,/&+]*)?$/i;
const ALT_GAP = /\bor\b|\//i;
const ALT_BEFORE = /(?:such as|like|e\.g\.?|including|for example|for instance|any of|one of|one or more of|either)\s*:?\s*$/i;
const ALT_AFTER = /^\s*,?\s*(?:or (?:similar|equivalent|comparable|another|other|related)\b|etc\b)/i;
const CLAUSE_BREAK = /[;()[\]|·•]|[.!?](?=\s|$)|\s[–—-]\s|,\s*(?=(?:plus|but|ideally|preferably|and ideally|and preferably|as well as)\b)/g;
const TITLE_WORD = /\b(?:engineer|developer|architect|lead|manager|scientist|programmer|sde|consultant|specialist|devops|sre|analyst|engineering)\b/i;
const YEARS = /\b(?:(?:minimum|min\.?|at least|over|more than)\s+(?:of\s+)?)?(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2})\s*\+?\s*)?(?:years?|yrs?)\b/gi;
const YEARS_CONTEXT = /experience|\bexp\b|background|professional|industry|engineering|development|developing|programming|working|hands-on|building|writing|coding|designing/i;

interface Line { start: number; end: number; section: Section; title: boolean; }
interface Clause { start: number; end: number; priority: Priority; skip: boolean; why: string; }

const BASE_WHY: Record<Section, string> = {
  none: 'no heading, so it counts as part of the role',
  must: 'under a must-have heading',
  role: 'under a responsibilities heading',
  nice: 'under a nice-to-have heading',
  skip: 'in a company or benefits section, so ignored',
};
interface Hit { start: number; end: number; sym: Sym; }

interface Cand {
  key: string;
  syms: Sym[];
  hits: Hit[];
  priority: Priority;
  at: number;
  quote: string;
  title: boolean;
}

const clean = (s: string) => s
  .replace(/^\s*\d{1,2}[.)]\s+/, '')
  .replace(/^[^\p{L}\p{N}]+/u, '')
  .replace(/\*\*|__/g, '')
  .trim()
  .toLowerCase();

function headerOf(s: string): Exclude<Section, 'none'> | null {
  const t = s.replace(/[:\s]+$/, '');
  if (!t || t.length > 60) return null;
  if (H_MUST.test(t)) return 'must';
  if (H_NICE.test(t)) return 'nice';
  if (H_ROLE.test(t)) return 'role';
  if (H_SKIP.test(t)) return 'skip';
  return null;
}

/** Every known skill in the text. Overlaps go to the longer match, then to the earlier symbol. */
function lex(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const sym of SYMBOLS) {
    for (const re of sym.re) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      for (const m of text.matchAll(g)) {
        if (m[0].length) hits.push({ start: m.index!, end: m.index! + m[0].length, sym });
      }
    }
  }
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || SYMBOL_INDEX.get(a.sym)! - SYMBOL_INDEX.get(b.sym)!);
  const kept: Hit[] = [];
  for (const h of hits) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  return kept.sort((a, b) => a.start - b.start);
}

/** Lines with their section. A header line ("Nice to have:") sets the section for the lines under it. */
function lines(text: string) {
  const out: Line[] = [];
  let section: Section = 'none';
  let headers = 0;
  let titleSeen = false;
  const re = /[^\n]*/g;
  for (const m of text.matchAll(re)) {
    const start = m.index!;
    const raw = m[0];
    if (!raw && start > 0 && text[start - 1] !== '\n') continue;  // matchAll yields an empty match after each line
    const c = clean(raw);
    let title = false;
    let own: Section | null = null;
    if (c) {
      const colon = c.indexOf(':');
      const head = headerOf(c);
      // "Nice to have: Kotlin" or "Location: Remote" covers its own line only.
      const inline = head ? null : colon > 0 && c.slice(colon + 1).trim() ? headerOf(c.slice(0, colon)) : null;
      if (head) { section = head; headers++; }
      else if (inline) { own = inline; headers++; }
      else if (!titleSeen && raw.trim().length <= 90 && TITLE_WORD.test(c)) title = true;
      titleSeen = true;
    }
    out.push({ start, end: start + raw.length, section: own ?? section, title });
  }
  return { lines: out, headers };
}

function clausesOf(text: string, line: Line, hits: Hit[]): Clause[] {
  const body = text.slice(line.start, line.end);
  const cuts = [0];
  for (const m of body.matchAll(CLAUSE_BREAK)) {
    // Never cut through a skill name such as "Node.js", or after "e.g." and "etc.".
    const at = line.start + m.index!;
    if (hits.some((h) => at >= h.start && at < h.end)) continue;
    if (m[0] === '.' && /\b(?:e\.g|i\.e|etc|vs|incl)$/i.test(body.slice(0, m.index!))) continue;
    cuts.push(m.index! + m[0].length);
  }
  cuts.push(body.length);
  const base: Priority = line.title ? 'must' : line.section === 'must' || line.section === 'nice' || line.section === 'role' ? line.section : 'role';
  const out: Clause[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = line.start + cuts[i], b = line.start + cuts[i + 1];
    if (b <= a) continue;
    const t = text.slice(a, b).toLowerCase();
    let priority = base;
    let skip = line.section === 'skip';
    let why = line.title ? 'in the job title' : BASE_WHY[line.section];
    const neg = NEG_CUE.exec(t), nice = NICE_CUE.exec(t), must = MUST_CUE.exec(t);
    if (neg) { skip = true; why = `“${neg[0]}”, so ignored`; }
    else if (nice) { priority = 'nice'; why = `cue “${nice[0]}”`; }
    else if (must && base !== 'nice') { priority = 'must'; why = `cue “${must[0]}”`; }
    // "Experience with AWS (a plus)": a cue with no skill of its own applies to the clause before it.
    const own = hits.some((h) => h.start >= a && h.start < b);
    const prev = out[out.length - 1];
    if (!own && prev && priority !== base && CUE_ONLY.test(t)) { prev.priority = priority; prev.why = `${why} right after it`; continue; }
    out.push({ start: a, end: b, priority, skip, why });
  }
  return out;
}

const better = (a: Priority, b: Priority) => (RANK[a] <= RANK[b] ? a : b);
const quoteOf = (s: string) => {
  const t = s.replace(/^\s*(?:[-*•●▪◦·–—>]+|\d{1,2}[.)])\s*/, '').replace(/\s+/g, ' ').trim().replace(/[,;:]$/, '');
  return t.length > 140 ? t.slice(0, 137).trimEnd() + '…' : t;
};

/** Candidates from one clause: "Kafka or RabbitMQ" is one requirement, "Java and Spring Boot" two. */
function candidates(text: string, clause: Clause, hits: Hit[], quote: string, splitSlash: boolean): Cand[] {
  const inside = hits.filter((h) => h.start >= clause.start && h.start < clause.end);
  const out: Cand[] = [];
  let i = 0;
  while (i < inside.length) {
    let j = i;
    let alt = false;
    while (j + 1 < inside.length) {
      const gap = text.slice(inside[j].end, inside[j + 1].start);
      if (!SEPARATOR.test(gap)) break;
      if (ALT_GAP.test(gap) && (splitSlash || /\bor\b/i.test(gap))) alt = true;
      j++;
    }
    const chain = inside.slice(i, j + 1);
    const before = text.slice(Math.max(clause.start, chain[0].start - 32), chain[0].start);
    const after = text.slice(chain[chain.length - 1].end, Math.min(clause.end, chain[chain.length - 1].end + 28));
    if (ALT_BEFORE.test(before) || ALT_AFTER.test(after)) alt = true;
    const syms = [...new Set(chain.map((h) => h.sym))];
    if (alt && syms.length > 1) {
      const ids = syms.map((x) => x.id).sort();
      out.push({ key: `alt:${ids.join('|')}`, syms, hits: chain, priority: clause.priority, at: chain[0].start, quote, title: !splitSlash });
    } else {
      for (const sym of syms) out.push({ key: sym.id, syms: [sym], hits: chain.filter((h) => h.sym === sym), priority: clause.priority, at: chain.find((h) => h.sym === sym)!.start, quote, title: !splitSlash });
    }
    i = j + 1;
  }
  return out;
}

const statusOf = (sym: Sym): Status => (sym.kind === 'have' || sym.kind === 'listed' ? 'match' : sym.kind === 'near' ? 'near' : 'miss');

function words(text: string, hits: Hit[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    const w = text.slice(h.start, h.end).replace(/\s+/g, ' ');
    if (!seen.has(w.toLowerCase())) { seen.add(w.toLowerCase()); out.push(w); }
  }
  return out;
}

function joinOr(list: string[]) {
  const l = list.slice(0, 4);
  return l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} or ${l[l.length - 1]}`;
}

function labelOf(text: string, c: Cand) {
  if (c.syms.length > 1) return joinOr(words(text, c.hits));
  const sym = c.syms[0];
  if (!sym.ownWords) return sym.name;
  // The JD's own words ("RabbitMQ / SQS") unless they are phrases; then the symbol's name reads better.
  const w = words(text, c.hits);
  return w.length === 1 || (w.length <= 3 && w.every((x) => !/[\s-]/.test(x))) ? w.join(' / ') : sym.name;
}

function yearsReq(text: string, ls: Line[], clauses: Map<Line, Clause[]>, hits: Hit[]) {
  const xp = experience();
  const have = xp.years + xp.months / 12;
  let best: { lo: number; hi: number | null; priority: Priority; start: number; end: number; quote: string } | null = null;
  for (const line of ls) {
    if (line.section === 'skip') continue;
    const body = text.slice(line.start, line.end);
    for (const m of body.matchAll(YEARS)) {
      const lo = +m[1];
      const hi = m[2] ? +m[2] : null;
      if (lo < 1 || lo > 20 || (hi !== null && hi < lo)) continue;
      const start = line.start + m.index!;
      const clause = clauses.get(line)?.find((c) => start >= c.start && start < c.end);
      if (!clause || clause.skip) continue;
      const ctx = text.slice(clause.start, clause.end);
      if (!YEARS_CONTEXT.test(ctx) && !hits.some((h) => h.start >= clause.start && h.start < clause.end)) continue;
      const cand = { lo, hi, priority: clause.priority, start, end: start + m[0].length, quote: quoteOf(ctx) };
      if (!best || RANK[cand.priority] < RANK[best.priority] || (cand.priority === best.priority && lo > best.lo)) best = cand;
    }
  }
  if (!best) return null;
  const credit = Math.min(1, have / best.lo);
  const range = best.hi ? `${best.lo}–${best.hi}` : `${best.lo}+`;
  let proof = `${xp.label} of professional experience, 2018 to now.`;
  if (best.hi && have > best.hi + 0.5) proof += ` Above the ${range} year range.`;
  const req: Req = {
    key: 'years', label: `${range} years of experience`, priority: best.priority,
    status: credit >= 1 ? 'match' : credit >= 0.75 ? 'near' : 'miss', listed: false, credit,
    proof, where: ['hub'], quote: best.quote, at: best.start, core: false,
  };
  return { req, span: { start: best.start, end: best.end } };
}

function notesFor(text: string, title: string | null): Note[] {
  const t = text.toLowerCase();
  const head = (title ?? '') + '\n' + text.split('\n').slice(0, 4).join('\n');
  const notes: Note[] = [];

  if (/\b(?:principal|staff|distinguished|architect|head of|director|vp)\b/i.test(head)) {
    notes.push({ label: 'Level', tone: 'warn', text: 'Staff-level scope: 8+ years and a team lead role (Accenture), not yet a Staff title.' });
  } else if (/\b(?:lead|manager)\b/i.test(head)) {
    notes.push({ label: 'Level', tone: 'ok', text: 'Team Lead at Accenture; led a 5–6 engineer team for Google Fiber.' });
  } else if (/\b(?:senior|sr\.?|sde[- ]?(?:ii|iii|2|3)|engineer (?:ii|iii|2|3))\b/i.test(head)) {
    notes.push({ label: 'Level', tone: 'ok', text: 'Senior: 8+ years, most recently Team Lead at Accenture.' });
  } else if (/\b(?:junior|jr\.?|entry[- ]level|graduate|intern(?:ship)?|fresher|trainee)\b/i.test(head)) {
    notes.push({ label: 'Level', tone: 'warn', text: 'Above this level: 8+ years of experience.' });
  }

  const remote = /\bremote\b|\bwork from home\b|\bwfh\b|\bwork from anywhere\b/.test(t) && !/\bnot (?:a )?remote\b|\bno remote\b|\bnon-remote\b/.test(t);
  const office = /\bhybrid\b|\bon[- ]?site\b|\bin[- ]office\b|\bin the office\b|\boffice[- ]based\b|\brelocat(?:e|ion)\b/.test(t);
  if (remote) notes.push({ label: 'Work mode', tone: 'ok', text: 'Remote: yes. Works from Gurugram, India (IST).' });
  else if (office) notes.push({ label: 'Work mode', tone: 'warn', text: 'Remote-first, from Gurugram, India (IST). On-site or hybrid terms need a conversation.' });
  else notes.push({ label: 'Work mode', tone: 'info', text: 'Not stated. Works remotely from Gurugram, India (IST).' });

  if (/\btime[- ]?zones?\b|\boverlap\b|\b(?:pst|est|cst|cet|cest|gmt|bst|utc|emea|apac)\b/.test(t)) {
    notes.push({ label: 'Time zone', tone: 'ok', text: 'IST, with working-hour overlap for EU and US teams.' });
  }
  if (/\bauthori[sz]ed to work\b|\bwork authori[sz]ation\b|\bu\.?s\.? citizens?(?:hip)?\b|\bgreen card\b|\bsecurity clearance\b|\bno (?:visa )?sponsorship\b|\bsponsorship (?:is )?not available\b|\bmust (?:be )?(?:located|based|reside) in\b/.test(t)) {
    notes.push({ label: 'Location', tone: 'warn', text: 'Based in India. Location or work-authorisation terms in the JD need a conversation.' });
  } else if (/\bgurugram\b|\bgurgaon\b|\bdelhi\b|\bnoida\b|\bncr\b/.test(t)) {
    notes.push({ label: 'Location', tone: 'ok', text: 'Based in Gurugram, Delhi NCR.' });
  } else if (/\bbengaluru\b|\bbangalore\b|\bpune\b|\bhyderabad\b|\bmumbai\b|\bchennai\b|\bkolkata\b|\bchandigarh\b|\bmohali\b|\bahmedabad\b/.test(t)) {
    notes.push({ label: 'Location', tone: office ? 'warn' : 'info', text: 'Based in Gurugram, Delhi NCR, and works remotely.' });
  } else if (/\bindia\b/.test(t)) {
    notes.push({ label: 'Location', tone: 'ok', text: 'Based in India (Gurugram, IST).' });
  }

  const contract = /\bcontract(?:or)?\b|\bcontract-to-hire\b|\bfreelance\b|\bc2h\b|\bpart[- ]time\b|\bhourly\b/.test(t);
  const fullTime = /\bfull[- ]time\b|\bpermanent\b|\bfte\b/.test(t);
  const now = /\bimmediate(?:ly)? (?:joiner|start|joining)\b|\bnotice period\b|\bjoin(?:ing)? within\b/.test(t);
  notes.push({
    label: 'Engagement', tone: contract || fullTime || now ? 'ok' : 'info',
    text: `${contract && !fullTime ? 'Contract: yes' : fullTime && !contract ? 'Full-time: yes' : 'Full-time or contract'} · available immediately.`,
  });

  if (/\bb\.?\s?tech\b|\bb\.e\.|\bbachelor'?s?\b|\bb\.?sc\b|\bcomputer science\b|\bengineering degree\b|\bdegree in\b|\bundergraduate degree\b/.test(t)) {
    notes.push({ label: 'Education', tone: 'ok', text: 'B.Tech, Computer Science & Engineering (2017).' });
  }
  return notes;
}

/** Compile a job description into a fit report. */
export function compileJd(input: string): Report {
  const t0 = performance.now();
  const text = input.replace(/\r\n?/g, '\n').replace(/[‘’]/g, "'").slice(0, MAX_CHARS);
  const hits = lex(text);
  const { lines: ls, headers } = lines(text);
  const titleLine = ls.find((l) => l.title);
  const hiring = text.slice(0, 600).match(/\b(?:hiring|looking for|seeking)\s+(?:an?\s+)?((?:[A-Z][\w+#./-]*\s+){0,4}(?:Engineer|Developer|Architect|Lead|Programmer|Scientist))\b/);
  const title = titleLine
    ? text.slice(titleLine.start, titleLine.end)
      .replace(/^[^\p{L}\p{N}]+/u, '').replace(/^(?:job title|title|role|position)\s*:\s*/i, '').replace(/\*\*/g, '').trim().slice(0, 90)
    : hiring ? hiring[1] : null;

  const clauseMap = new Map<Line, Clause[]>();
  const cands: Cand[] = [];
  let mentions = 0;
  for (const line of ls) {
    if (line.end <= line.start) continue;
    const cs = clausesOf(text, line, hits);
    clauseMap.set(line, cs);
    for (const c of cs) {
      if (c.skip) continue;
      const quote = quoteOf(text.slice(line.start, line.end));
      const found = candidates(text, c, hits, quote, !line.title);
      for (const f of found) mentions += f.hits.length;
      cands.push(...found);
    }
  }

  // Merge repeated mentions; keep the strongest priority and the first quote.
  const merged = new Map<string, Cand>();
  for (const c of cands) {
    const m = merged.get(c.key);
    if (!m) { merged.set(c.key, { ...c, hits: [...c.hits] }); continue; }
    m.priority = better(m.priority, c.priority);
    m.title ||= c.title;
    m.hits.push(...c.hits);
    if (c.at < m.at) { m.at = c.at; m.quote = c.quote; }
  }

  // "Kafka or RabbitMQ" adds nothing when Kafka is already its own requirement and is the best option.
  const best = (c: Cand) => c.syms.reduce((a, b) => (b.credit > a.credit ? b : a));
  for (const [key, g] of merged) {
    if (g.syms.length < 2) continue;
    const top = best(g);
    const single = g.syms.map((x) => merged.get(x.id)).find((s) => s && s.syms[0].credit === top.credit);
    if (single) {
      single.priority = better(single.priority, g.priority);
      single.title ||= g.title;
      single.hits.push(...g.hits);
      merged.delete(key);
    }
  }

  const ordered = [...merged.values()].sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.at - b.at);
  const reqs: Req[] = [];
  const spans: Span[] = [];
  for (const c of ordered) {
    const top = best(c);
    const i = reqs.length;
    reqs.push({
      key: c.key, label: labelOf(text, c), priority: c.priority, status: statusOf(top), listed: top.kind === 'listed',
      credit: top.credit, proof: top.proof, where: top.where, quote: c.quote, at: c.at, core: c.title && !top.domain,
    });
    for (const h of c.hits) spans.push({ start: h.start, end: h.end, req: i });
  }

  const yrs = yearsReq(text, ls, clauseMap, hits);
  if (yrs) {
    const at = reqs.findIndex((r) => RANK[r.priority] > RANK[yrs.req.priority]);
    const i = at < 0 ? reqs.length : at;
    reqs.splice(i, 0, yrs.req);
    for (const sp of spans) if (sp.req >= i) sp.req++;
    spans.push({ ...yrs.span, req: i });
  }
  spans.sort((a, b) => a.start - b.start);

  const total = reqs.reduce((s, r) => s + WEIGHT[r.priority], 0);
  const got = reqs.reduce((s, r) => s + WEIGHT[r.priority] * r.credit, 0);
  const counts: Record<Status, number> = { match: 0, near: 0, miss: 0 };
  for (const r of reqs) counts[r.status]++;
  let fit = total ? Math.round((got / total) * 100) : 0;
  const notes = notesFor(text, title);

  // The stack in the job title is a gate, not one requirement among many: a ".NET Developer" role
  // is not a 75% fit because the generic lines match. When none of the title's stack is on the
  // résumé, the score is capped at 40% plus whatever adjacent credit it earned.
  const core = reqs.filter((r) => r.core);
  const coreCredit = core.length ? Math.max(...core.map((r) => r.credit)) : 1;
  let cap: number | null = null;
  if (coreCredit < 0.85) {
    const limit = Math.round(40 + 60 * coreCredit);
    const names = core.map((r) => r.label).join(', ');
    const adjacent = core.some((r) => r.status === 'near');
    if (fit > limit) { fit = limit; cap = limit; }
    notes.unshift({
      label: 'Core stack', tone: 'warn',
      text: `The title asks for ${names}, which ${adjacent ? 'only has adjacent experience on' : 'is not on'} the résumé${cap ? `, so the score is capped at ${cap}%` : ''}.`,
    });
  }

  return {
    text, title, words: text.trim() ? text.trim().split(/\s+/).length : 0, sections: headers, mentions,
    reqs, spans, notes, fit, cap, counts, ms: performance.now() - t0,
    stages: {
      tokens: hits.map((h) => ({ word: text.slice(h.start, h.end), sym: h.sym.id, name: h.sym.name, kind: h.sym.kind, at: h.start })),
      clauses: [...clauseMap.entries()].flatMap(([line, cs]) => cs.flatMap((c) => {
        const inside = hits.filter((h) => h.start >= c.start && h.start < c.end);
        if (!inside.length) return [];
        // A clause cut from the title ("Java)") reads better as the whole title.
        const raw = line.title ? text.slice(line.start, line.end) : text.slice(c.start, c.end);
        const shown = quoteOf(raw).replace(/^[\s()[\]|·•,;:–—-]+|[\s([|·•,;:–—-]+$/g, '');
        return [{ text: shown, priority: c.priority, why: c.why, skip: c.skip, words: inside.map((h) => text.slice(h.start, h.end)) }];
      })),
    },
  };
}
