# career-runtime

An interactive résumé, designed as a polyglot microservice system.

Each chapter of my career is drawn as a service in the language I used at that company, all connected by a Kafka ring to a hub that "compiles" the résumé. Click a service and it comes apart into its layers — API, business logic, runtime internals — down to the bytecode.

**Site:** https://sudo-ycode.github.io/career-runtime/

| Module | Language / runtime | Career chapter |
|---|---|---|
| `fleet-tracker` | Java 21, Spring Boot | Rocket Flyer (2018–19) |
| `notify` | Node.js, NestJS | Tech Mahindra, client AT&T (2019–21) |
| `edge-gateway` | Java, Vert.x | Publicis Sapient, client Fidelity International (2021–23) |
| `migrator` | Kotlin, coroutines | Accenture, client Google (2023–25) |
| `speech` | Python, PyTorch | Accenture, client FedEx (2025) |
| `career-core` | the hub | the decision log, and the JD compiler stage by stage |

## What is real

- **Bytecode panels.** `runtime-samples/` holds one real function per runtime. `tools/snapshot-bytecode.mjs` compiles each one and records what the runtime actually executes: `javap -c` for Java and Kotlin, V8 Ignition output for Node.js, `dis` for CPython. A missing toolchain is recorded as pending, never invented.
- **Résumé content.** Everything comes from `web/src/data/career.ts`, the same data the printable résumé view uses.
- **Career log.** The overview plays the career as the Kafka partition `career.events / 0`: real milestones, oldest first, drawn as Kafka really works (`web/src/ui/kafka.ts`).
  - Each record is appended on the leader broker, fetched by two followers, and only then passes the high watermark.
  - The consumer group `career-core` trails behind with its committed offset, so the lag shown is real.
  - The log rolls into segment files named after their first offset.
  - A `kafka-console-consumer` underneath prints each record as it is consumed.
  - It starts a few seconds after the page opens and loops with a 10-second pause. "Show all" stops it.

The runtime charts are generated in the browser and follow how each runtime really behaves (G1 heap sawtooth, V8 scavenges, Vert.x per-loop delay, CPython GC).

## The hub

`career-core` is the consumer of every topic, and it never stops polling. Inside its glass cap, each poll arrives as one mixed batch. A rotor turns to each record's partition, and the record runs out along that lane to its bin. Each lane points at the service its topic comes from. An RGB strip runs under the cap. All of it animates only `transform` and `opacity`, so it runs on the browser's compositor with no main-thread work (`web/src/scene/hub.ts`). In chaos mode a killed hub freezes and goes dark, then catches up at speed when it restarts.

## The engineer

Below the hero, an on-call panel shows who is on call for this system and how to page them, drawn as a HUD. It has a cut-corner frame and my portrait in a hexagon with a scan line. The readouts give status, terms, hours, three live clocks (IST, London, New York), location and contact. The résumé page keeps a smaller portrait fixed at the top right. Both pictures fade into the page instead of sitting in a frame, load only when needed, and appear only once fully decoded. The printable résumé leaves the photo out. The link-preview card (`web/public/og.jpg`, rendered by `web/scripts/og.mjs`) puts the same portrait beside the system. It is a JPEG under 100 KB, because WhatsApp skips preview images over about 300 KB.

## Chaos mode

"Break my career" lets a visitor kill any service, or the hub, and watch the system heal. Each incident runs the playbook a production service would: liveness probes fail, a circuit breaker opens on the service's cable, its events wait on Kafka as consumer lag, the process restarts with exponential backoff (sometimes the first attempt fails), the breaker half-opens and closes, and the consumer replays everything from its last committed offset. Killing `career-core` shows graceful degradation: the résumé keeps being served from the last compiled snapshot. The sealed module refuses to die. `?chaos` in the URL opens straight into chaos mode, which is what the in-page "Share result" button links to. It all runs in the browser (`web/src/scene/chaos.ts` for the effects, `web/src/ui/chaos.ts` for the playbook and console).

## JD compiler

"Compile your JD" turns a job description into a fit report:
- **Lex.** A rules-based compiler (`web/src/jd/compile.ts`) finds 124 skills and their aliases, listed in `web/src/data/skills.ts`.
- **Parse.** It reads section headings ("Requirements", "Nice to have"), cue words ("strong", "a plus"), alternatives ("Java or Go") and the years asked for.
- **Link.** Each requirement resolves to one of four outcomes: a project that proves it, the résumé's skills list, adjacent experience for partial credit, or nothing. A gap is marked like a compiler error.

The scene acts as the linker: each requirement flies from the text to the module that proves it. The output has three parts:
- a weighted fit score; when the stack named in the job title is not on the résumé (a ".NET Developer" role), the score is capped and the report says so
- the logistics a recruiter checks first: level, work mode, location and engagement
- a full report with Copy, Email, Save as PDF and Share

It all runs in the browser, with no model and no server. A shared link (`#/fit/…`) carries the job description compressed after the `#`, which browsers never send to a server. `?jd` or `#/jd` opens the compiler directly.

## Decisions

The hub's page (`#/decisions`) is the reasoning the résumé leaves out. The career is drawn as a distributed trace: a span for each role, child spans for the work inside it, and a marker for each decision. Each marker opens an architecture decision record covering the context, the options considered, the choice, and what it bought and cost. There are twelve, from splitting the Rocket Flyer platform by capability to fine-tuning Gemma inside a compile-and-retry loop. The projects and choices come from the résumé; the reasoning is the standard engineering case for each choice, with no invented metrics (`web/src/data/decisions.ts`).

Below the trace, the JD compiler runs stage by stage on any job description: lexed tokens, parsed clauses and their priorities, linked requirements, and the score arithmetic. It is the same code the home page uses.

## Layout

```
web/              Vite + TypeScript + GSAP; SVG isometric scenes. Deployed to GitHub Pages.
runtime-samples/  The real functions behind the bytecode panels.
tools/            snapshot-bytecode.mjs
docs/             Design decisions.
```

## Run

```bash
cd web
npm install
npm run dev
```

`npm run bytecode` refreshes the bytecode snapshots (needs a JDK, the Kotlin compiler and Python on PATH; CI installs all three).

See [docs/design-decisions.md](docs/design-decisions.md) for the reasoning behind the design.
