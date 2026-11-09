// Single source of truth for the site's content. Every fact here comes from the résumé.

export type ServiceId = 'fleet-tracker' | 'notify' | 'edge-gateway' | 'migrator' | 'speech' | 'private-rnd';
export type LayerKind = 'ports' | 'circuit' | 'chambers' | 'turbine' | 'loop' | 'reactors' | 'statemachine';

export interface Hue { id: string; base: string; light: string; deep: string; }

export const HUES = {
  java: { id: 'java', base: '#ec8a3f', light: '#ffc792', deep: '#7a3a12' },
  node: { id: 'node', base: '#5fd16a', light: '#b8f5bd', deep: '#1b5a24' },
  vertx: { id: 'vertx', base: '#d35bd8', light: '#f3b6f5', deep: '#5c1a60' },
  kotlin: { id: 'kotlin', base: '#8f6cf7', light: '#cdbcff', deep: '#35217a' },
  python: { id: 'python', base: '#4b8bdf', light: '#a2c8f7', deep: '#163d70' },
  sealed: { id: 'sealed', base: '#7d8796', light: '#c6ccd6', deep: '#262b33' },
} satisfies Record<string, Hue>;

export interface Layer {
  kind: LayerKind;
  name: string;
  /** What the layer is, technically. */
  tech: string;
  /** Why it matters, or where I used it. */
  note: string;
  /** Compartments, loop phases or coroutine states, depending on kind. */
  parts?: string[];
  count?: number;
}

export interface MetricChart { key: string; label: string; unit: string; kind: 'area' | 'bars' | 'loops'; max: number; digits?: number; }
export interface MetricGauge { key: string; label: string; unit: string; max: number; digits?: number; }

export interface Service {
  id: ServiceId;
  name: string;
  language: string;
  runtime: string;
  hue: Hue;
  topic: string;
  company: string;
  companyShort: string;
  client?: string;
  role: string;
  start: string;
  end: string | null;
  summary: string;
  built: string[];
  stack: string[];
  layers: Layer[];
  charts: MetricChart[];
  gauges: MetricGauge[];
  sealed?: boolean;
}

export const SERVICES: Service[] = [
  {
    id: 'fleet-tracker',
    name: 'fleet-tracker',
    language: 'Java 21 · Spring Boot',
    runtime: 'JVM (HotSpot)',
    hue: HUES.java,
    topic: 'fleet.positions',
    company: 'Rocket Flyer Technology',
    companyShort: 'Rocket Flyer',
    role: 'Software Development Engineer-1',
    start: '2018-01-08',
    end: '2019-08-02',
    summary:
      'Vehicles stream GPS fixes; the service turns them into distance, ETA and fare, and publishes positions to Kafka. ' +
      'It is the same shape of system I built from scratch at Rocket Flyer, rebuilt in modern Java.',
    built: [
      'Built a fleet management, pricing and live-tracking platform from scratch on Spring Boot microservices, with Angular dashboards on Leaflet and Mapbox.',
      'Processed raw fleet-tracking data into tracking APIs; added chauffeur tracking and driving-behaviour monitoring.',
      'Built user management on Spring MVC and Spring Security, plus notification, analytics and SEO metadata APIs.',
      'Delivered loan-application and car-rental platforms for client companies.',
    ],
    stack: ['Java', 'Spring Boot', 'Spring MVC', 'Spring Security', 'Microservices', 'Angular', 'Leaflet', 'Mapbox'],
    layers: [
      { kind: 'ports', name: 'REST and Kafka edge', tech: 'Spring Web controllers · spring-kafka producer', note: 'Tracking, pricing and notification APIs at Rocket Flyer' },
      { kind: 'circuit', name: 'ETA and pricing engine', tech: 'Haversine distance · speed model · fare rules', note: 'Pricing models and raw fleet-data processing, built from scratch' },
      { kind: 'reactors', name: 'Virtual threads', tech: 'Thousands of virtual threads mounted on a few carrier threads', note: 'Blocking-style code that scales like async I/O (Java 21)', count: 4 },
      { kind: 'chambers', name: 'JVM heap', tech: 'G1 regions: Eden, Survivor, Old · Metaspace off-heap', note: 'Short-lived GPS objects die young in Eden; minor GCs stay cheap', parts: ['Eden', 'Survivor', 'Old', 'Metaspace'] },
      { kind: 'turbine', name: 'JIT compiler', tech: 'Tiered compilation: interpreter → C1 → C2', note: 'Hot paths such as haversineKm get compiled to native code' },
    ],
    charts: [
      { key: 'heapMb', label: 'Heap used', unit: 'MB', kind: 'area', max: 512 },
      { key: 'gcPauseMs', label: 'GC pauses', unit: 'ms', kind: 'bars', max: 25, digits: 1 },
    ],
    gauges: [
      { key: 'reqPerSec', label: 'Positions published', unit: '/s', max: 10, digits: 1 },
      { key: 'virtualThreads', label: 'Virtual threads started', unit: '/s', max: 40 },
    ],
  },
  {
    id: 'notify',
    name: 'notify',
    language: 'Node.js 24 · NestJS',
    runtime: 'V8 + libuv',
    hue: HUES.node,
    topic: 'notifications',
    company: 'Tech Mahindra',
    companyShort: 'Tech Mahindra',
    client: 'AT&T',
    role: 'Software Engineer',
    start: '2019-08-07',
    end: '2021-05-17',
    summary:
      'Consumes career events from Kafka and fans them out as push, email or SMS, with a Redis cache in front of user preferences. ' +
      'Modelled on the AT&T notification services I built at Tech Mahindra.',
    built: [
      'EFACTS & Syntrac/MLD (AT&T): backend services in Node.js with NestJS and a React front end; APIs secured with Passport.js and Helmet; typed API clients with Axios and Zod.',
      'iComply & Tarp (AT&T): event-driven notification and messaging microservices on Kafka, plus REST APIs consumed by Angular components.',
      'ATLAS (AT&T): job-tracking REST APIs with Redis caching of job status, Angular UI components and Docker images for the platform team.',
    ],
    stack: ['Node.js', 'NestJS', 'TypeScript', 'Kafka', 'Redis', 'React', 'Angular', 'Docker'],
    layers: [
      { kind: 'ports', name: 'Controllers and Kafka consumer', tech: 'NestJS controllers · KafkaJS consumer group', note: 'AT&T iComply & Tarp: event-driven notification services' },
      { kind: 'circuit', name: 'Fan-out and channel rules', tech: 'Push, email, SMS · quiet hours · Redis cache', note: 'ATLAS: hot job-status reads cached in Redis' },
      { kind: 'loop', name: 'libuv event loop', tech: 'One thread, six phases, non-blocking I/O', note: 'Never block the loop: slow work goes to the thread pool', parts: ['timers', 'pending', 'idle', 'poll', 'check', 'close'] },
      { kind: 'chambers', name: 'V8 heap', tech: 'New space · Old space · Code space · Large objects', note: 'Event payloads die young; Scavenge clears new space in milliseconds', parts: ['New', 'Old', 'Code', 'Large'] },
      { kind: 'turbine', name: 'V8 compiler tiers', tech: 'Ignition → Sparkplug → Maglev → TurboFan', note: 'Like the JVM, V8 optimises the functions that run hot' },
    ],
    charts: [
      { key: 'loopDelayMs', label: 'Event-loop delay p99', unit: 'ms', kind: 'area', max: 20, digits: 1 },
      { key: 'heapMb', label: 'V8 heap', unit: 'MB', kind: 'area', max: 140 },
    ],
    gauges: [
      { key: 'cacheHit', label: 'Redis hit rate', unit: '%', max: 100, digits: 1 },
      { key: 'notifPerSec', label: 'Notifications', unit: '/s', max: 60 },
    ],
  },
  {
    id: 'edge-gateway',
    name: 'edge-gateway',
    language: 'Java 21 · Vert.x',
    runtime: 'Vert.x on Netty',
    hue: HUES.vertx,
    topic: 'gateway.requests',
    company: 'Publicis Sapient',
    companyShort: 'Sapient',
    client: 'Fidelity International',
    role: 'Associate Technology L2 (Software Engineer)',
    start: '2021-08-18',
    end: '2023-09-04',
    summary:
      'The front door: a reactive API gateway that checks JWTs, rate-limits callers and streams the live career feed to the browser. ' +
      'The same reactive Vert.x style I used for Fidelity International.',
    built: [
      'Fidelity International & 8 Roads: reactive RESTful APIs in Java on Vert.x for new product features and status-flow changes, secured with OAuth2/JWT.',
      'Built the Angular components and RxJS services that consume those APIs.',
      'PeopleSoft (internal): Python REST APIs with Django REST Framework and PostgreSQL for manager mapping and leave approvals.',
    ],
    stack: ['Java', 'Vert.x', 'OAuth2/JWT', 'Angular', 'RxJS', 'Python', 'Django REST Framework', 'PostgreSQL'],
    layers: [
      { kind: 'ports', name: 'Routes and JWT auth', tech: 'Vert.x Web router · JWTAuthHandler · SSE stream', note: 'Fidelity: reactive APIs secured with OAuth2/JWT' },
      { kind: 'circuit', name: 'Rate limits and routing', tech: 'Token buckets · event bus · backpressure', note: 'Status-flow changes routed without blocking a thread' },
      { kind: 'reactors', name: 'Multi-reactor event loops', tech: 'Event loops = 2 × CPU cores; each verticle sticks to one', note: 'One blocked loop raises a warning; the rest keep serving', count: 8 },
      { kind: 'chambers', name: 'Heap and Netty buffers', tech: 'JVM heap · pooled direct buffers · Metaspace', note: 'Netty reuses off-heap buffers to avoid GC churn', parts: ['Heap', 'Direct', 'Meta'] },
      { kind: 'turbine', name: 'JIT compiler', tech: 'Tiered compilation: interpreter → C1 → C2', note: 'The handler chain is hot code; C2 inlines it' },
    ],
    charts: [
      { key: 'reqPerSec', label: 'Requests', unit: '/s', kind: 'area', max: 700 },
      { key: 'loops', label: 'Delay per event loop', unit: 'ms', kind: 'loops', max: 15, digits: 1 },
    ],
    gauges: [
      { key: 'jwtPerSec', label: 'JWT checks', unit: '/s', max: 700 },
      { key: 'blocked', label: 'Blocked-loop warnings', unit: '/min', max: 6 },
    ],
  },
  {
    id: 'migrator',
    name: 'migrator',
    language: 'Kotlin · coroutines',
    runtime: 'JVM (HotSpot)',
    hue: HUES.kotlin,
    topic: 'migrations',
    company: 'Accenture',
    companyShort: 'Accenture',
    client: 'Google',
    role: 'Custom Software Engineering Consultant',
    start: '2023-12-15',
    end: '2025-03-01',
    summary:
      'A build-migration agent: rules convert a build file to Gradle, the build runs, and an LLM repairs whatever the compiler rejects until it goes green. ' +
      'A small, open version of the agent my team owned in the Google Fiber migration pipeline.',
    built: [
      'Led a 5–6 engineer team owning the build-migration agent in an n8n pipeline of 30–40+ AI agents that migrated Google Fiber microservices from Blaze to Gradle.',
      "Fine-tuned Google's open-source Gemma model on a curated corpus of Blaze build files so the agent could translate Blaze definitions into Gradle builds.",
      "Built and maintained distributed Kotlin backend services on a Google internal platform, under Google's code-review and observability practices.",
    ],
    stack: ['Kotlin', 'Coroutines', 'Gradle', 'Gemma', 'LLM fine-tuning', 'n8n', 'Multi-agent systems'],
    layers: [
      { kind: 'ports', name: 'REST and Kafka edge', tech: 'Ktor routes · Kafka producer for migration results', note: 'Google Fiber: one agent in a 30–40+ agent pipeline' },
      { kind: 'circuit', name: 'Agent loop', tech: 'Rules → gradle build → LLM fix → retry', note: 'Gemma fine-tuned on Blaze build files drove the fixes' },
      { kind: 'statemachine', name: 'Coroutine state machine', tech: 'kotlinc turns each suspend fun into labelled states', note: 'Each suspension point frees the thread while the build or model runs', parts: ['convert', 'build ⏸', 'llm.fix ⏸', 'done'] },
      { kind: 'chambers', name: 'JVM heap', tech: 'G1 regions: Eden, Survivor, Old · Metaspace', note: 'Build logs are big but short-lived', parts: ['Eden', 'Survivor', 'Old', 'Metaspace'] },
      { kind: 'turbine', name: 'JIT compiler', tech: 'Kotlin compiles to the same bytecode, so C1 and C2 apply', note: 'One runtime, two languages' },
    ],
    charts: [
      { key: 'coroutines', label: 'Active coroutines', unit: '', kind: 'area', max: 80 },
      { key: 'heapMb', label: 'Heap used', unit: 'MB', kind: 'area', max: 384 },
    ],
    gauges: [
      { key: 'greenRate', label: 'Builds green', unit: '%', max: 100, digits: 1 },
      { key: 'avgAttempts', label: 'Attempts per target', unit: '', max: 4, digits: 2 },
    ],
  },
  {
    id: 'speech',
    name: 'speech',
    language: 'Python 3 · FastAPI · PyTorch',
    runtime: 'CPython',
    hue: HUES.python,
    topic: 'transcripts',
    company: 'Accenture',
    companyShort: 'Accenture',
    client: 'FedEx',
    role: 'Custom Software Engineering Team Lead',
    start: '2025-03-01',
    end: '2025-12-16',
    summary:
      'Speech-to-text: short audio clips go through voice detection, feature extraction and a speech model, and come out as transcripts with a word error rate. ' +
      'A compact version of the FedEx ASR work I led.',
    built: [
      'Fine-tuned NVIDIA Nemotron speech models on an NVIDIA Parakeet base to build a speech-to-text (ASR) system adapted to a FedEx operational use case.',
      'As Development Enabler, owned work allocation and dependency resolution for the team and coordinated priorities with the FedEx client team.',
      "Streamlined the project's GitHub Actions CI/CD workflows.",
      'Built REST APIs in Python and Node.js, and maintained Java and Spring Boot services with Couchbase persistence.',
    ],
    stack: ['Python', 'PyTorch', 'NVIDIA Nemotron', 'Parakeet', 'Speech recognition', 'GitHub Actions', 'Couchbase', 'Spring Boot'],
    layers: [
      { kind: 'ports', name: 'FastAPI and Kafka edge', tech: 'FastAPI upload route · aiokafka producer', note: 'FedEx: REST APIs in Python and Node.js' },
      { kind: 'circuit', name: 'ASR pipeline', tech: 'Voice detection → log-mel features → model → text', note: 'Nemotron models fine-tuned on a Parakeet base' },
      { kind: 'chambers', name: 'PyTorch tensors', tech: 'Weights · activations · buffers · cache', note: 'Inference only: no autograd graph, so memory stays flat', parts: ['Weights', 'Activ.', 'Buffers', 'Cache'] },
      { kind: 'loop', name: 'CPython eval loop', tech: 'Fetch → decode → dispatch, one bytecode at a time, under the GIL', note: 'Heavy maths runs in C kernels outside the loop', parts: ['fetch', 'decode', 'dispatch', 'execute'] },
      { kind: 'turbine', name: 'Bytecode compiler', tech: 'Source → tokens → AST → bytecode (.pyc)', note: 'Compiled once, cached, then interpreted' },
    ],
    charts: [
      { key: 'latencyMs', label: 'Inference latency', unit: 'ms', kind: 'area', max: 420 },
      { key: 'gcGen0', label: 'GC gen-0 collections', unit: '', kind: 'bars', max: 5 },
    ],
    gauges: [
      { key: 'rtf', label: 'Real-time factor', unit: '×', max: 0.3, digits: 3 },
      { key: 'reqPerSec', label: 'Clips', unit: '/s', max: 8, digits: 1 },
    ],
  },
  {
    id: 'private-rnd',
    name: 'private-rnd',
    language: 'Sealed',
    runtime: 'Private',
    hue: HUES.sealed,
    topic: '—',
    company: 'Freelance',
    companyShort: 'Freelance',
    role: 'Software Engineer',
    start: '2025-12-17',
    end: null,
    summary:
      'A multi-engine systematic trading platform and VAAK, an expressive Hindi text-to-speech engine. Both codebases are private, so this module stays sealed.',
    built: [],
    stack: ['Python', 'PyTorch', 'Hugging Face', 'Backtesting', 'Text-to-speech'],
    layers: [],
    charts: [],
    gauges: [],
    sealed: true,
  },
];

export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);

/** The overview's career log: one ordered partition, oldest record first. Played once, then replayable. */
export interface LogRecord { when: string; svc: ServiceId | 'hub'; text: string; }

export const CAREER_LOG: LogRecord[] = [
  { when: '2018-01', svc: 'fleet-tracker', text: 'Joined Rocket Flyer Technology as SDE-1 · Java, Spring Boot' },
  { when: '2018–19', svc: 'fleet-tracker', text: 'Built a fleet management, pricing and live-tracking platform from scratch' },
  { when: '2019-08', svc: 'notify', text: 'Joined Tech Mahindra · client AT&T · Node.js, NestJS' },
  { when: '2019–21', svc: 'notify', text: 'Event-driven notification services on Kafka for AT&T iComply & Tarp' },
  { when: '2019–21', svc: 'notify', text: 'Job-tracking APIs with Redis-cached status for AT&T ATLAS' },
  { when: '2021-08', svc: 'edge-gateway', text: 'Joined Publicis Sapient · client Fidelity International' },
  { when: '2021–23', svc: 'edge-gateway', text: 'Reactive Java APIs on Vert.x, secured with OAuth2/JWT' },
  { when: '2023-12', svc: 'migrator', text: 'Joined Accenture · client Google · Kotlin' },
  { when: '2024–25', svc: 'migrator', text: 'Led the 5–6 engineer team behind the build-migration agent in a 30–40+ agent pipeline' },
  { when: '2024–25', svc: 'migrator', text: 'Fine-tuned Gemma to convert Google Fiber builds from Blaze to Gradle' },
  { when: '2025-03', svc: 'speech', text: 'Team Lead on the FedEx account · Python, PyTorch' },
  { when: '2025', svc: 'speech', text: 'Fine-tuned NVIDIA Nemotron speech models on a Parakeet base for FedEx speech-to-text' },
  { when: '2025-12', svc: 'private-rnd', text: 'Freelance: a systematic trading platform and a Hindi text-to-speech engine, both private' },
  { when: 'now', svc: 'hub', text: 'career-core compiled the log into this résumé · open to remote work' },
];

export const HUB = {
  name: 'career-core',
  language: 'Kotlin · Postgres',
  summary: 'Consumes every topic and compiles the stream into this résumé.',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export function period(svc: { start: string; end: string | null }) {
  return `${monthYear(svc.start)} – ${svc.end ? monthYear(svc.end) : 'present'}`;
}

export function years(svc: { start: string; end: string | null }) {
  const a = svc.start.slice(0, 4);
  const b = svc.end ? svc.end.slice(0, 4) : 'now';
  return a === b ? a : `${a}–${b}`;
}

/** Paid working time, gaps between jobs excluded. Counts up on its own. */
export function experience(now = new Date()) {
  const stints: [string, string | null][] = [
    ['2018-01-08', '2019-08-02'],
    ['2019-08-07', '2021-05-17'],
    ['2021-08-18', '2023-09-04'],
    ['2023-12-15', '2025-12-16'],
    ['2025-12-17', null],
  ];
  const days = stints.reduce((sum, [a, b]) => {
    const end = b ? new Date(b + 'T00:00:00Z') : now;
    return sum + (end.getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86_400_000;
  }, 0);
  const months = Math.floor(days / 30.4375);
  return { years: Math.floor(months / 12), months: months % 12, label: `${Math.floor(months / 12)} yrs ${months % 12} mo` };
}

export const PROFILE = {
  name: 'Yatin Verma',
  title: 'Senior Backend & AI Engineer',
  location: 'Gurugram, India',
  workMode: 'Remote · IST with EU and US overlap',
  availability: 'Full-time or contract · available immediately',
  email: ['verma.yatin1720', 'gmail.com'] as const,
  linkedin: 'https://www.linkedin.com/in/yatinv/',
  summary: [
    'Senior backend and AI engineer with 8+ years delivering production systems for Google, FedEx, Fidelity International and AT&T, through Accenture, Publicis Sapient and Tech Mahindra.',
    'Core stack: Java, Kotlin and Spring Boot microservices, with Python (Django) and Node.js (NestJS) services and Angular/React front ends. Also Kafka, Redis, PostgreSQL, Couchbase, Docker and GitHub Actions.',
    "At Accenture (client Google), I led a 5–6 engineer team that fine-tuned Google's Gemma model to power the build-migration agent in a 30–40+ agent n8n pipeline, moving Google Fiber microservices from Blaze to Gradle. For FedEx, I fine-tuned NVIDIA Nemotron speech models on a Parakeet base for a speech-to-text system, and was the team's Development Enabler.",
  ],
  highlights: [
    'Led the 5–6 engineer team behind the build-migration agent of a 30–40+ agent AI pipeline for Google Fiber, fine-tuning Gemma to convert Blaze builds to Gradle.',
    'Delivered a domain-adapted speech-to-text system for FedEx by fine-tuning NVIDIA Nemotron speech models on a Parakeet base.',
    'Built reactive Java APIs on Vert.x for Fidelity International and event-driven Kafka services for AT&T.',
  ],
  experience: [
    {
      company: 'Freelance', title: 'Software Engineer', start: '2025-12-17', end: null as string | null,
      points: [
        'Mission Control: architected and own a multi-engine systematic trading platform for Indian equity markets, with market-data ingestion, independent strategy engines, a volatility-regime router and a central monitoring console.',
        'Validation pipeline: backtesting and paper trading over 30 years of multi-timeframe data, champion–challenger evaluation, and max-drawdown kill switches gating promotion to live.',
        'VAAK: building an expressive Hindi text-to-speech engine trained on a 5,000+ hour speech corpus (PyTorch, Hugging Face, custom SentencePiece tokenizer).',
      ],
    },
    {
      company: 'Accenture', title: 'Custom Software Engineering Team Lead (Client: FedEx)', start: '2025-03-01', end: '2025-12-16',
      points: SERVICES[4].built,
    },
    {
      company: 'Accenture', title: 'Custom Software Engineering Consultant (Client: Google)', start: '2023-12-15', end: '2025-03-01',
      points: SERVICES[3].built,
    },
    {
      company: 'Publicis Sapient', title: 'Associate Technology L2 (Software Engineer)', start: '2021-08-18', end: '2023-09-04',
      points: SERVICES[2].built,
    },
    {
      company: 'Tech Mahindra', title: 'Software Engineer (Client: AT&T)', start: '2019-08-07', end: '2021-05-17',
      points: SERVICES[1].built,
    },
    {
      company: 'Rocket Flyer Technology', title: 'Software Development Engineer-1', start: '2018-01-08', end: '2019-08-02',
      points: SERVICES[0].built,
    },
  ],
  skills: [
    { group: 'Core', items: ['Java', 'Spring Boot', 'Microservices', 'Kotlin', 'Python', 'Node.js', 'REST APIs', 'Generative AI', 'LLMs', 'AI agents'] },
    { group: 'AI and data', items: ['LLM fine-tuning', 'n8n', 'Workflow automation', 'PyTorch', 'Hugging Face', 'Speech recognition', 'Text-to-speech', 'pandas'] },
    { group: 'Backend and infrastructure', items: ['Spring Framework', 'NestJS', 'Django REST Framework', 'Kafka', 'Hibernate', 'Vert.x', 'PostgreSQL', 'MongoDB', 'Redis', 'Couchbase', 'Docker', 'Kubernetes', 'Jenkins', 'GitHub Actions', 'AWS'] },
    { group: 'Front end and testing', items: ['Angular', 'React', 'TypeScript', 'RxJS', 'JUnit', 'Mockito', 'Jest', 'Gradle', 'Maven', 'Bazel'] },
  ],
  education: { degree: 'B.Tech, Computer Science & Engineering', school: 'I.K. Gujral Punjab Technical University', years: '2013 – 2017' },
};

export const emailAddress = () => PROFILE.email.join('@');
