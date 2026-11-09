// career-core's decision log. The projects and choices are the résumé's; the reasoning is the
// standard engineering case for each choice. No metrics are claimed that the résumé does not state.
import type { ServiceId } from './career';

export type Tag = 'architecture' | 'data' | 'reliability' | 'ai' | 'security';
export const TAGS: { id: Tag; label: string }[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'data', label: 'Data' },
  { id: 'reliability', label: 'Reliability' },
  { id: 'ai', label: 'AI / ML' },
  { id: 'security', label: 'Security' },
];

/** One row of the career trace: a role (child of the root) or a piece of work (child of a role). */
export interface TraceSpan {
  id: string;
  parent: string | null;
  name: string;
  detail: string;
  /** Colours the bar; 'site' is this portfolio. */
  svc: ServiceId | 'site' | null;
  start: string;
  end: string | null;
}

export interface Option { name: string; why: string; chosen?: boolean; }

export interface Adr {
  id: string;
  title: string;
  span: string;
  svc: ServiceId | 'site';
  tags: Tag[];
  /** Where the marker sits along its span, 0–1. */
  at: number;
  context: string;
  options: Option[];
  decision: string;
  gains: string[];
  costs: string[];
}

export const SPANS: TraceSpan[] = [
  { id: 'career', parent: null, name: 'career', detail: 'gaps left in', svc: null, start: '2018-01-08', end: null },

  { id: 'rf', parent: 'career', name: 'Rocket Flyer', detail: 'SDE-1', svc: 'fleet-tracker', start: '2018-01-08', end: '2019-08-02' },
  { id: 'rf-fleet', parent: 'rf', name: 'fleet & pricing platform', detail: 'Spring Boot microservices', svc: 'fleet-tracker', start: '2018-01-08', end: '2019-08-02' },

  { id: 'tm', parent: 'career', name: 'Tech Mahindra · AT&T', detail: 'Software Engineer', svc: 'notify', start: '2019-08-07', end: '2021-05-17' },
  { id: 'tm-icomply', parent: 'tm', name: 'iComply & Tarp', detail: 'notifications on Kafka', svc: 'notify', start: '2019-08-07', end: '2021-05-17' },
  { id: 'tm-atlas', parent: 'tm', name: 'ATLAS', detail: 'job tracking', svc: 'notify', start: '2019-08-07', end: '2021-05-17' },
  { id: 'tm-efacts', parent: 'tm', name: 'EFACTS & Syntrac/MLD', detail: 'NestJS + React', svc: 'notify', start: '2019-08-07', end: '2021-05-17' },

  { id: 'ps', parent: 'career', name: 'Sapient · Fidelity', detail: 'Software Engineer', svc: 'edge-gateway', start: '2021-08-18', end: '2023-09-04' },
  { id: 'ps-fidelity', parent: 'ps', name: 'reactive APIs', detail: 'Vert.x, OAuth2/JWT', svc: 'edge-gateway', start: '2021-08-18', end: '2023-09-04' },

  { id: 'ag', parent: 'career', name: 'Accenture · Google', detail: 'Consultant', svc: 'migrator', start: '2023-12-15', end: '2025-03-01' },
  { id: 'ag-migrator', parent: 'ag', name: 'build-migration agent', detail: 'Blaze → Gradle, Gemma', svc: 'migrator', start: '2023-12-15', end: '2025-03-01' },

  { id: 'af', parent: 'career', name: 'Accenture · FedEx', detail: 'Team Lead', svc: 'speech', start: '2025-03-01', end: '2025-12-16' },
  { id: 'af-asr', parent: 'af', name: 'speech-to-text', detail: 'Nemotron on Parakeet', svc: 'speech', start: '2025-03-01', end: '2025-12-16' },

  { id: 'fl', parent: 'career', name: 'Freelance', detail: 'Software Engineer', svc: 'private-rnd', start: '2025-12-17', end: null },
  { id: 'fl-trading', parent: 'fl', name: 'systematic trading platform', detail: 'private', svc: 'private-rnd', start: '2025-12-17', end: null },
  { id: 'fl-vaak', parent: 'fl', name: 'VAAK', detail: 'Hindi text-to-speech, private', svc: 'private-rnd', start: '2025-12-17', end: null },
  { id: 'fl-site', parent: 'fl', name: 'career-runtime', detail: 'this site', svc: 'site', start: '2026-11-03', end: null },
];

export const ADRS: Adr[] = [
  {
    id: 'adr-001', title: 'Split the platform by business capability', span: 'rf-fleet', svc: 'fleet-tracker', tags: ['architecture'], at: 0.12,
    context:
      'Rocket Flyer needed fleet management, pricing and live tracking, built from scratch by a small team. The parts behave very differently: ' +
      'GPS fixes arrive all day, pricing rules change often, user accounts barely change. In one deployable, a bad pricing release would take live tracking down with it.',
    options: [
      { name: 'One Spring Boot monolith', why: 'Fastest to start, but every release redeploys tracking, and the GPS write load scales the whole application.' },
      { name: 'Services by technical layer (web, logic, data)', why: 'Still one release train: a pricing change touches all three.' },
      { name: 'One service per business capability', why: 'Tracking, pricing, users and notifications each own their data and deploy on their own.', chosen: true },
    ],
    decision:
      'Spring Boot microservices split by capability: tracking, pricing, user management on Spring MVC and Spring Security, notifications and analytics, ' +
      'with Angular dashboards on Leaflet and Mapbox on top.',
    gains: [
      'Tracking scales and ships without waiting for pricing.',
      'A failure stays inside one capability instead of taking the platform down.',
      'Each service’s data model fits its own job.',
    ],
    costs: [
      'More moving parts for a small team: calls between services, separate deploys, separate logs.',
      'No transactions across services, so workflows that span them need retries and careful ordering.',
      'Debugging one request means following it across services.',
    ],
  },
  {
    id: 'adr-002', title: 'Derive positions and distances when a fix arrives, not when it is read', span: 'rf-fleet', svc: 'fleet-tracker', tags: ['data'], at: 0.42,
    context:
      'Vehicles send raw GPS fixes: noisy, high-volume and useless to a dashboard as they are. The map needs a current position, ' +
      'the fare needs a distance, and the operator wants to know how each driver drives.',
    options: [
      { name: 'Store raw fixes, compute on every read', why: 'Simple to write, but every map refresh and every fare repeats the same maths over thousands of points.' },
      { name: 'A nightly batch job', why: 'Cheap, but a nightly job cannot do live tracking.' },
      { name: 'Process each fix as it arrives', why: 'Clean it once, update the vehicle’s current state and running distance, and let the APIs read that.', chosen: true },
    ],
    decision:
      'An ingestion path turns raw fleet-tracking data into derived state, such as current position and distance travelled, ' +
      'and the tracking and pricing APIs read that state directly.',
    gains: [
      'Map and fare reads become cheap lookups.',
      'Bad fixes, such as GPS jumps, are filtered once, on the way in.',
      'Chauffeur tracking and driving-behaviour monitoring plug into the same stream.',
    ],
    costs: [
      'Ingestion becomes the critical path: if it stalls, the map goes stale.',
      'Changing how a metric is derived means reprocessing history.',
      'Fixes that arrive out of order need handling.',
    ],
  },
  {
    id: 'adr-003', title: 'Notifications as events on Kafka, not direct calls', span: 'tm-icomply', svc: 'notify', tags: ['architecture', 'reliability'], at: 0.15,
    context:
      'On AT&T iComply and Tarp, many services needed to trigger notifications and messages. If each called the notification service directly, ' +
      'a slow or failed notifier would slow or fail every caller, and every new consumer would mean changing every producer.',
    options: [
      { name: 'Synchronous REST calls', why: 'Easy to follow, but every producer depends on the notifier’s uptime and latency.' },
      { name: 'A work queue', why: 'Decouples the services, but a message is gone once consumed: no replay, and each message goes to one consumer.' },
      { name: 'Kafka topics', why: 'Producers publish and move on; consumers read at their own pace and can replay from their last committed offset.', chosen: true },
    ],
    decision: 'Event-driven notification and messaging microservices on Kafka, built in Node.js with NestJS.',
    gains: [
      'Producers never wait on, or fail because of, notifications.',
      'A consumer that crashes catches up from its committed offset, so nothing is lost. Chaos mode on the home page plays out exactly this.',
      'New consumers subscribe without touching the producers.',
    ],
    costs: [
      'Eventual consistency: a notification can arrive seconds after the event.',
      'At-least-once delivery means duplicates, so consumers must be idempotent.',
      'Ordering holds only within a partition, and there is a cluster to run.',
    ],
  },
  {
    id: 'adr-004', title: 'Cache job status in Redis', span: 'tm-atlas', svc: 'notify', tags: ['data'], at: 0.3,
    context:
      'ATLAS job-tracking screens ask for job status far more often than status changes. Sending every one of those reads to the system of record ' +
      'spends its capacity on answers it has already given.',
    options: [
      { name: 'Read through to the database every time', why: 'Always fresh, but the hottest path hits the database on every refresh.' },
      { name: 'An in-memory cache in each instance', why: 'Fast, but each instance holds its own copy, and the copies disagree.' },
      { name: 'A shared Redis cache', why: 'One in-memory copy for every instance, in front of the database.', chosen: true },
    ],
    decision: 'Job-status reads go to Redis first; the database serves the misses and owns every write.',
    gains: [
      'Hot reads come from memory.',
      'Every instance sees the same cached status.',
      'The database’s capacity goes to writes and cold reads.',
    ],
    costs: [
      'Two copies of the truth: a status change must update or expire its cache entry, or users see a stale status.',
      'Redis is one more dependency, so a miss or an outage must fall back to the database instead of failing.',
      'The hit rate needs watching; a cache that misses is pure overhead.',
    ],
  },
  {
    id: 'adr-005', title: 'Validate data at the edges with one schema', span: 'tm-efacts', svc: 'notify', tags: ['security'], at: 0.45,
    context:
      'EFACTS and Syntrac/MLD were NestJS backends behind a React front end. TypeScript types vanish at run time, ' +
      'so a malformed payload can travel through a perfectly typed codebase until something deep inside breaks.',
    options: [
      { name: 'Trust the TypeScript types', why: 'Costs nothing, and protects nothing at run time.' },
      { name: 'Hand-written checks', why: 'Work, but drift away from the types as the code changes.' },
      { name: 'Zod schemas at the boundary', why: 'One schema gives both the run-time check and the static type.', chosen: true },
    ],
    decision: 'Typed API clients built with Axios and Zod, and APIs secured with Passport.js and Helmet.',
    gains: [
      'Bad data fails at the edge with a clear error, not deep inside business logic.',
      'The types and the validation cannot drift apart.',
      'Passport.js handles authentication; Helmet sets safe HTTP headers by default.',
    ],
    costs: [
      'Schemas to maintain alongside the code.',
      'A little validation work on every request.',
    ],
  },
  {
    id: 'adr-006', title: 'Never block the event loop', span: 'ps-fidelity', svc: 'edge-gateway', tags: ['architecture', 'reliability'], at: 0.2,
    context:
      'The Fidelity International APIs ran on Vert.x, where a few event-loop threads serve every request. Most of a request’s time is spent ' +
      'waiting on downstream systems, and one blocking call on a loop stalls every request that loop owns.',
    options: [
      { name: 'Blocking calls inside handlers', why: 'Familiar code, but one slow query freezes a whole loop.' },
      { name: 'Go back to a thread per request', why: 'Simple again, but threads sit idle while they wait, and memory grows with traffic.' },
      { name: 'Non-blocking all the way; blocking work off the loop', why: 'Asynchronous clients for I/O, and anything unavoidably blocking runs on Vert.x worker threads.', chosen: true },
    ],
    decision: 'Reactive, non-blocking APIs on Vert.x for new product features and status-flow changes, secured with OAuth2/JWT and consumed by RxJS services in Angular.',
    gains: [
      'A handful of threads serve many concurrent requests, and latency stays flat under load.',
      'Vert.x’s blocked-thread checker warns the moment the rule is broken. The edge-gateway page shows that warning.',
    ],
    costs: [
      'Asynchronous code is harder to read and debug: stack traces stop at the loop.',
      'Every library has to be checked for hidden blocking calls.',
      'The whole team has to keep the discipline.',
    ],
  },
  {
    id: 'adr-007', title: 'A small open model, fine-tuned, inside a compile-and-retry loop', span: 'ag-migrator', svc: 'migrator', tags: ['ai', 'architecture'], at: 0.2,
    context:
      'Google Fiber microservices had to move from Blaze to Gradle. Most of each conversion is mechanical, but the long tail of edge cases never ends. ' +
      'My 5–6 engineer team owned the build-migration agent, one of 30–40+ agents in an n8n pipeline, and the code being converted is proprietary.',
    options: [
      { name: 'Hand-written conversion rules only', why: 'Predictable, but every new edge case is another rule, forever.' },
      { name: 'Prompt a large general model', why: 'Flexible, but its output varies from run to run, it does not know the house conventions, and every call costs.' },
      { name: 'Fine-tune Gemma on curated Blaze build files', why: 'An open model that learns the conventions from real examples.', chosen: true },
    ],
    decision:
      'Fine-tune Google’s open Gemma model on a curated corpus of Blaze build files, and run it inside a loop: convert, run the Gradle build, ' +
      'feed the compiler’s errors back, and retry until the build is green.',
    gains: [
      'The model writes build files the way the codebase already writes them.',
      'The compiler is the judge: a conversion that does not build never moves on.',
      'An open model can run where the code lives.',
    ],
    costs: [
      'Curating the training corpus is real work, and it must be refreshed as conventions change.',
      'A green build can still hide a change in behaviour, so tests and code review stay in the loop.',
      'Training and serving a model is infrastructure the team now owns.',
    ],
  },
  {
    id: 'adr-008', title: 'Adapt an open speech model to the domain', span: 'af-asr', svc: 'speech', tags: ['ai'], at: 0.2,
    context:
      'FedEx needed speech-to-text for an operational use case. General speech models learn from everyday speech; ' +
      'operational audio is full of domain vocabulary, codes and names that they get wrong.',
    options: [
      { name: 'An off-the-shelf speech-to-text API', why: 'Quick to start, but weak on domain terms, and there is no way to improve it.' },
      { name: 'Train a model from scratch', why: 'Full control, but it needs far more labelled audio and compute.' },
      { name: 'Fine-tune a strong open model', why: 'Start from NVIDIA Parakeet and adapt Nemotron speech models to the domain.', chosen: true },
    ],
    decision: 'Fine-tune NVIDIA Nemotron speech models on a Parakeet base, and judge each version by word error rate on held-out domain audio.',
    gains: [
      'The model learns the domain’s words instead of guessing them.',
      'Progress is measured on the team’s own test set, not on a vendor’s benchmark.',
      'The model is versioned and shipped like any other service.',
    ],
    costs: [
      'It needs labelled domain audio, which is slow to collect.',
      'A training and evaluation pipeline to maintain.',
      'GPU cost for training and for serving.',
    ],
  },
  {
    id: 'adr-009', title: 'Nothing goes live without beating the champion on paper', span: 'fl-trading', svc: 'private-rnd', tags: ['reliability'], at: 0.15,
    context:
      'A multi-engine systematic trading platform. A backtest can look brilliant and still be fitted to the past, ' +
      'and promoting the wrong engine costs real money.',
    options: [
      { name: 'Promote on backtest results', why: 'Fast, but it rewards overfitting.' },
      { name: 'Promote by judgement', why: 'Flexible, but inconsistent and hard to audit.' },
      { name: 'Staged promotion with a kill switch', why: 'Backtest, then paper trading, then live: a challenger must beat the current champion, and a max-drawdown kill switch bounds the damage.', chosen: true },
    ],
    decision:
      'Every engine passes a validation pipeline: backtesting over 30 years of multi-timeframe data, paper trading and champion–challenger evaluation, ' +
      'with max-drawdown kill switches gating promotion to live.',
    gains: [
      'An engine proves itself on data it has never seen before it touches money.',
      'Losses are bounded by design, not by vigilance.',
    ],
    costs: [
      'Slower to go live.',
      'Paper trading cannot fully model real fills and slippage.',
      'The pipeline and its monitoring console are systems in their own right.',
    ],
  },
  {
    id: 'adr-010', title: 'Train a Hindi tokenizer instead of borrowing one', span: 'fl-vaak', svc: 'private-rnd', tags: ['ai'], at: 0.25,
    context:
      'VAAK is an expressive Hindi text-to-speech engine trained on a 5,000+ hour speech corpus. Tokenizers built mostly for English break ' +
      'Devanagari text into many tiny, meaningless pieces, which makes sequences long and the model’s job harder.',
    options: [
      { name: 'Characters as tokens', why: 'Simple and complete, but sequences are long and there is no sense of sub-words.' },
      { name: 'Reuse an English-centric tokenizer', why: 'No work, but poor splits for Hindi.' },
      { name: 'Train SentencePiece on the Hindi text', why: 'Sub-word units that fit the language.', chosen: true },
    ],
    decision: 'A custom SentencePiece tokenizer trained on the project’s own Hindi text, in a PyTorch and Hugging Face stack.',
    gains: [
      'Shorter, more meaningful token sequences.',
      'A vocabulary that covers how Hindi is actually written.',
    ],
    costs: [
      'The tokenizer becomes part of the model’s contract: change it and the model is retrained.',
      'Text normalisation, such as numbers and English words inside Hindi sentences, has to happen before tokenizing.',
    ],
  },
  {
    id: 'adr-011', title: 'No backend: the whole site runs in the browser', span: 'fl-site', svc: 'site', tags: ['architecture'], at: 0.3,
    context: 'This portfolio has to stay up for years, load fast, cost nothing and never need a 3 a.m. restart.',
    options: [
      { name: 'Run the real services (Kafka, the JVM, Python) in the cloud', why: 'Live numbers, but a monthly bill, operations work, and one more thing that can be down when a recruiter visits.' },
      { name: 'Serverless functions', why: 'Cheaper, but cold starts, and still something to maintain.' },
      { name: 'A static site on GitHub Pages', why: 'Everything, the JD compiler included, runs in the visitor’s browser.', chosen: true },
    ],
    decision:
      'Static hosting. The runtime charts are generated in the browser from how each runtime behaves; the bytecode panels are real compiler output, captured at build time.',
    gains: [
      'Free, fast, and nothing to keep alive.',
      'A pasted job description never leaves the visitor’s browser.',
    ],
    costs: [
      'The charts show modelled behaviour, not production metrics.',
      'Anything dynamic has to be computed on the client.',
    ],
  },
  {
    id: 'adr-012', title: 'Rules, not a language model, for the JD compiler', span: 'fl-site', svc: 'site', tags: ['ai'], at: 0.75,
    context: 'The JD compiler has to score any pasted job description against the résumé: honestly, for free, and without a server.',
    options: [
      { name: 'Ask a large language model', why: 'Best at nuance, but it needs an API key and a server, costs per use, varies from run to run and can overstate a match.' },
      { name: 'Embedding similarity', why: 'Catches synonyms, but a similarity score explains nothing.' },
      { name: 'Deterministic rules', why: 'A table of skills and aliases, section and cue parsing, and fixed credits.', chosen: true },
    ],
    decision:
      'A rules-based compiler: lex, parse, link, score. Every match points to a résumé line, adjacent experience earns stated partial credit, ' +
      'and a missing core stack caps the score.',
    gains: [
      'Same job description, same score, every time.',
      'Runs offline; nothing is uploaded.',
      'Every number can be explained. The stage-by-stage view below shows how.',
    ],
    costs: [
      'It only knows the skills in its table.',
      'It reads words, not meaning: “millions of events a second” is not Kafka unless Kafka is named.',
    ],
  },
];

export const adrById = (id: string) => ADRS.find((a) => a.id === id);
export const adrsFor = (svc: ServiceId) => ADRS.filter((a) => a.svc === svc);
export const adrNumber = (a: Adr) => a.id.toUpperCase();
