// The JD compiler's symbol table: every skill a job description might ask for, and what backs it up.
// Proof lines come from the résumé (career.ts and the résumé's skills list). Nothing here adds a claim.
import type { ServiceId } from './career';

/** A module in the overview scene, or the hub, which stands for the résumé's skills list. */
export type Where = ServiceId | 'hub';

/**
 * have:   shipped in a role, with a project to point at.
 * listed: on the résumé's skills list, without a headline project on this site.
 * near:   not claimed; the closest real experience earns partial credit.
 * none:   not claimed and nothing close.
 */
export type Kind = 'have' | 'listed' | 'near' | 'none';

export interface Sym {
  id: string;
  name: string;
  re: RegExp[];
  kind: Kind;
  /** 0–1: how much of the requirement this covers. */
  credit: number;
  /** Where the proof lives in the scene. */
  where: Where[];
  /** The proof (have, listed) or the nearest experience (near). Empty for none. */
  proof: string;
  /** Near and none symbols are labelled with the JD's own words ("RabbitMQ"), the rest with `name`. */
  ownWords?: boolean;
  /** An industry, not a stack: never treated as the role's core stack. */
  domain?: boolean;
}

const have = (id: string, name: string, re: RegExp[], where: ServiceId[], proof: string, credit = 1): Sym =>
  ({ id, name, re, kind: 'have', credit, where, proof });
const listed = (id: string, name: string, re: RegExp[], proof = 'On the résumé’s skills list.', where: Where[] = ['hub']): Sym =>
  ({ id, name, re, kind: 'listed', credit: 0.85, where, proof });
const near = (id: string, name: string, re: RegExp[], credit: number, where: Where[], proof: string): Sym =>
  ({ id, name, re, kind: 'near', credit, where, proof, ownWords: true });
const none = (id: string, name: string, re: RegExp[]): Sym =>
  ({ id, name, re, kind: 'none', credit: 0, where: [], proof: '', ownWords: true });

/**
 * Order matters only for ties: when two symbols match the same text, the earlier one wins.
 * A longer match always beats a shorter one ("Spring Boot" over "Spring", "LLM APIs" over "APIs").
 */
export const SYMBOLS: Sym[] = [
  // Languages
  have('java', 'Java', [/\bjava\b(?![\s-]*script)|\bjvm\b|\bj2ee\b/i], ['fleet-tracker', 'edge-gateway', 'speech'],
    'Java since 2018: the Spring Boot platform at Rocket Flyer, reactive Vert.x APIs for Fidelity International, Java and Spring Boot services for FedEx.'),
  have('kotlin', 'Kotlin', [/\bkotlin\b/i], ['migrator'],
    'Distributed Kotlin backend services for Google Fiber, under Google’s code review (Accenture, 2023–25).'),
  have('python', 'Python', [/\bpython\b/i], ['speech', 'edge-gateway', 'private-rnd'],
    'Python REST APIs for FedEx, Django REST APIs at Publicis Sapient, and PyTorch speech work.'),
  have('typescript', 'TypeScript', [/\btypescript\b/i], ['notify'],
    'TypeScript across the NestJS services and typed API clients (Axios, Zod) for AT&T.'),
  have('javascript', 'JavaScript', [/\b[Jj]ava[Ss]cript\b|\bJAVASCRIPT\b|(?<![.\w])JS\b|\bES6\b|\bECMAScript\b/], ['notify'],
    'JavaScript and TypeScript in Node.js services and Angular and React front ends.'),
  have('sql', 'SQL', [/(?<![\w-])SQL\b/, /\brelational databases?\b|\brdbms\b/i], ['edge-gateway'],
    'SQL with PostgreSQL behind the Django REST APIs at Publicis Sapient.'),
  near('go', 'Go', [/\b[Gg]olang\b/, /\bGo\b(?=\s*(?:[,/)]|$)|\s+(?:or|and|lang|developers?|engineers?|services?|microservices|programming|language|backend|code)\b)/m],
    0.3, ['migrator', 'edge-gateway'], 'Concurrent JVM services: Kotlin coroutines (Google Fiber) and Vert.x event loops (Fidelity).'),
  near('scala', 'Scala', [/\bscala\b/i], 0.5, ['migrator', 'edge-gateway'], 'Java and Kotlin on the JVM.'),
  near('csharp', 'C# / .NET', [/\bC#(?!\w)|(?<!\w)\.NET\b|\bdotnet\b|\bASP\.NET\b/i], 0.25, ['fleet-tracker', 'edge-gateway'], 'Java and Spring, a similar enterprise stack.'),
  near('android', 'Android', [/\bandroid\b/i], 0.25, ['migrator'], 'Kotlin backend services (Google Fiber).'),
  none('rust', 'Rust', [/\bRust\b/]),
  none('cpp', 'C++', [/\bC\+\+(?!\w)|\bcpp\b/i]),
  none('ruby', 'Ruby', [/\bruby\b|\brails\b/i]),
  none('php', 'PHP', [/\bphp\b|\blaravel\b/i]),
  none('ios', 'iOS / Swift', [/\bSwift(?:UI)?\b|\biOS\b|\bObjective-C\b/]),
  none('flutter', 'Flutter', [/\bflutter\b|\bdart\b/i]),
  none('beam', 'Elixir / Erlang', [/\belixir\b|\berlang\b|\bhaskell\b|\bclojure\b/i]),
  // Whole platforms that are not on the résumé. Naming them keeps such a JD from looking like a fit
  // just because its generic lines ("REST APIs", "communication") match.
  none('dotnet-stack', '.NET ecosystem', [/\bentity framework\b|\blinq\b|\bblazor\b|\bwpf\b|\bxamarin\b|\bwinforms\b/i]),
  none('salesforce', 'Salesforce', [/\bsalesforce\b|\bapex\b|\blightning web components\b|\blwc\b|\bsoql\b|\bvisualforce\b/i]),
  none('sap', 'SAP', [/\bSAP\b|\bS\/4\s?HANA\b/, /\babap\b/i]),
  none('enterprise-platforms', 'Enterprise platforms', [/\bservicenow\b|\bpega\b|\bworkday\b|\bdynamics 365\b|\bmulesoft\b|\binformatica\b|\btalend\b|\boutsystems\b/i]),
  none('mainframe', 'Mainframe', [/\bmainframe\b|\bcobol\b|\bjcl\b|\bcics\b/i]),
  none('embedded', 'Embedded', [/\bembedded (?:c|systems?|software|linux)\b|\bfirmware\b|\brtos\b|\bverilog\b|\bvhdl\b|\bfpga\b/i]),
  none('games', 'Game engines', [/\bUnity(?:3D)?\b|\bUnreal(?: Engine)?\b/]),
  none('web3', 'Blockchain', [/\bsolidity\b|\bblockchain\b|\bweb3\b|\bsmart contracts?\b|\bethereum\b/i]),
  none('cms', 'CMS / e-commerce platforms', [/\bwordpress\b|\bshopify\b|\bmagento\b|\bdrupal\b/i]),
  none('bi', 'BI tools', [/\bpower bi\b|\btableau\b|\blooker\b|\bqlik\b/i]),

  // Backend frameworks and APIs
  have('spring-boot', 'Spring Boot', [/\bspring[\s-]?boot\b/i], ['fleet-tracker', 'speech'],
    'Spring Boot microservices for the Rocket Flyer platform, and Java and Spring Boot services for FedEx.'),
  have('spring', 'Spring', [/\bspring(?:\s+(?:framework|mvc|security|cloud|data|batch|integration))?\b(?![\s-]?boot)/i], ['fleet-tracker'],
    'Spring MVC and Spring Security at Rocket Flyer; the Spring ecosystem (Boot, MVC, Security, Cloud, Data) on the résumé.'),
  listed('hibernate', 'Hibernate / JPA', [/\bhibernate\b|\bjpa\b|\borm\b/i]),
  have('reactive', 'Reactive programming', [/\bvert\.?x\b|\breactive\b|\bnon-?blocking\b|\bevent[\s-]loops?\b|\brxjava\b|\basync(?:hronous)?\s+(?:programming|i\/o|apis?|processing)\b/i], ['edge-gateway'],
    'Reactive, non-blocking Java APIs on Vert.x for Fidelity International.'),
  near('webflux', 'Spring WebFlux', [/\b(?:spring )?webflux\b|\bproject reactor\b/i], 0.8, ['edge-gateway'], 'Reactive Java on Vert.x (Fidelity): the same non-blocking model.'),
  near('jvm-frameworks', 'Quarkus / Micronaut', [/\bquarkus\b|\bmicronaut\b|\bdropwizard\b|\bhelidon\b/i], 0.6, ['fleet-tracker', 'edge-gateway'], 'Spring Boot and Vert.x.'),
  have('node', 'Node.js', [/\bnode\.?js\b/i, /\bNode\b(?=\s*(?:[,/)]|$)|\s+(?:and|or|backend|services?|developers?|engineers?|ecosystem)\b)/m], ['notify', 'speech'],
    'Node.js services with NestJS for AT&T, and REST APIs in Node.js for FedEx.'),
  have('nestjs', 'NestJS', [/\bnest\.?js\b/i], ['notify'],
    'NestJS backends for AT&T EFACTS and Syntrac/MLD, secured with Passport.js and Helmet.'),
  near('express', 'Express', [/\bexpress\.?js\b/i, /\bExpress\b(?=\s*(?:[,/)]|$)|\s+(?:or|and|framework|server)\b)/m], 0.85, ['notify'], 'NestJS, which runs on Express (AT&T).'),
  have('django', 'Django', [/\bdjango\b|\bdrf\b/i], ['edge-gateway'],
    'Django REST Framework and PostgreSQL APIs for manager mapping and leave approvals at Publicis Sapient.'),
  near('python-web', 'FastAPI / Flask', [/\bfast\s?api\b|\bflask\b/i], 0.7, ['edge-gateway', 'speech'], 'Python REST APIs: Django REST Framework at Publicis Sapient, and services for FedEx.'),
  have('rest', 'REST APIs', [/\bREST(?:ful)?\b/, /\brestful\b|\bapi (?:design|development|first)\b|\bweb services?\b/i, /\bAPIs?\b/], ['fleet-tracker', 'notify', 'edge-gateway', 'speech'],
    'REST APIs at every job: tracking and pricing at Rocket Flyer, job tracking for AT&T, reactive APIs for Fidelity, Python and Node.js APIs for FedEx.'),
  near('graphql', 'GraphQL', [/\bgraphql\b/i], 0.4, ['fleet-tracker', 'edge-gateway'], 'REST API design across four employers.'),
  near('grpc', 'gRPC', [/\bgrpc\b|\bprotobuf\b|\bprotocol buffers\b/i], 0.4, ['edge-gateway', 'notify'], 'REST APIs and Kafka event contracts.'),

  // Architecture
  have('microservices', 'Microservices', [/\bmicro-?services?\b|\bservice[- ]oriented\b|\bSOA\b/i], ['fleet-tracker', 'notify', 'migrator'],
    'Spring Boot microservices at Rocket Flyer, Kafka microservices for AT&T, and the Blaze-to-Gradle migration of Google Fiber microservices.'),
  have('distributed', 'Distributed systems', [/\bdistributed (?:systems?|architectures?|computing|services|applications)\b|\bscalab(?:le|ility)\b|\bhigh[- ]availability\b|\bhighly available\b|\bfault[- ]toleran(?:t|ce)\b|\bresilien(?:t|ce|cy)\b/i], ['migrator', 'notify', 'edge-gateway'],
    'Distributed Kotlin services for Google, event-driven Kafka services for AT&T, non-blocking APIs on Vert.x for Fidelity.'),
  have('event-driven', 'Event-driven architecture', [/\bevent[- ]driven\b|\bpub\s*\/\s*sub\b|\bmessage (?:queues?|brokers?|bus)\b|\bmessaging\b|\bevent streaming\b|\bstreaming (?:platforms?|data)\b/i], ['notify'],
    'Event-driven notification and messaging microservices on Kafka for AT&T iComply & Tarp.'),
  near('event-sourcing', 'Event sourcing / CQRS', [/\bevent[- ]sourc(?:ing|ed)\b|\bcqrs\b|\bsaga pattern\b|\boutbox pattern\b/i], 0.6, ['notify'], 'Event-driven services on Kafka (AT&T).'),
  have('kafka', 'Kafka', [/\bkafka(?: streams)?\b|\bconfluent\b|\bksqldb\b/i], ['notify'],
    'Event-driven notification and messaging microservices on Kafka for AT&T (2019–21).'),
  near('brokers', 'Message brokers', [/\brabbit\s?mq\b|\bactive\s?mq\b|\bamazon sqs\b|\bsqs\b|\bsns\b|\bkinesis\b|\bpulsar\b|\bnats\b|\bjms\b|\bazure service bus\b|\bgoogle pub\/sub\b/i], 0.6, ['notify'], 'Kafka event-driven services (AT&T).'),
  have('system-design', 'System design', [/\bsystem design\b|\bsoftware architecture\b|\bsolutions? architecture\b|\bdesign patterns\b|\btechnical design\b|\barchitect(?:ed|ing)? (?:scalable |distributed |new )?(?:systems|services|solutions|platforms?)\b|\barchitecture (?:decisions|reviews?)\b|\bend[- ]to[- ]end ownership\b/i], ['fleet-tracker', 'private-rnd'],
    'Built Rocket Flyer’s fleet, pricing and tracking platform from scratch; architected a multi-engine trading platform (freelance).'),
  have('performance', 'Performance', [/\bperformance (?:tuning|optimi[sz]ation|engineering)\b|\blow[- ]latency\b|\bhigh[- ]throughput\b|\bhigh[- ]performance\b|\blatency\b|\bthroughput\b/i], ['notify', 'edge-gateway'],
    'Redis caching of hot reads for AT&T; non-blocking APIs on Vert.x for Fidelity.', 0.85),
  have('concurrency', 'Concurrency', [/\bconcurren(?:t|cy)\b|\bmulti-?thread(?:ed|ing)?\b|\bparallel(?:ism| processing| programming)\b|\bcoroutines?\b|\bvirtual threads\b/i], ['migrator', 'edge-gateway'],
    'Kotlin coroutines for Google Fiber; Vert.x event loops for Fidelity.'),

  // Data
  have('redis', 'Redis / caching', [/\bredis\b|\bcach(?:e|es|ing)\b|\bmemcached\b/i], ['notify'],
    'Redis caching of hot job-status reads for AT&T ATLAS.'),
  have('postgres', 'PostgreSQL', [/\bpostgres(?:ql)?\b|\bpsql\b/i], ['edge-gateway'],
    'PostgreSQL behind the Django REST APIs at Publicis Sapient.'),
  near('mysql', 'MySQL', [/\bmysql\b|\bmaria\s?db\b/i], 0.8, ['edge-gateway'], 'PostgreSQL and SQL.'),
  near('oracle', 'Oracle / SQL Server', [/\boracle\b|\bsql server\b|\bmssql\b|\bdb2\b/i], 0.6, ['edge-gateway'], 'PostgreSQL and SQL.'),
  listed('mongodb', 'MongoDB', [/\bmongo(?:db)?\b/i]),
  have('couchbase', 'Couchbase', [/\bcouchbase\b/i], ['speech'],
    'Java and Spring Boot services with Couchbase persistence for FedEx.'),
  have('nosql', 'NoSQL', [/\bno-?sql\b|\bdocument (?:databases?|stores?)\b|\bkey[- ]value stores?\b/i], ['speech', 'notify'],
    'Couchbase for FedEx and Redis for AT&T; MongoDB on the résumé.'),
  near('nosql-other', 'Other NoSQL', [/\bcassandra\b|\bdynamo\s?db\b|\bscylla(?:db)?\b|\bcosmos\s?db\b|\bhbase\b|\bneo4j\b|\bfirestore\b/i], 0.5, ['speech', 'notify'], 'Couchbase and Redis in production; MongoDB on the résumé.'),
  none('search', 'Elasticsearch', [/\belastic\s?search\b|\bopensearch\b|\bsolr\b|\blucene\b/i]),
  listed('sqlite', 'SQLite', [/\bsqlite\b/i]),
  have('data-modeling', 'Data modelling', [/\bdata model(?:l)?ing\b|\bschema design\b|\bdatabase design\b/i], ['edge-gateway', 'speech'],
    'Data layers on PostgreSQL (Publicis Sapient) and Couchbase (FedEx).', 0.85),
  have('data-pipelines', 'Data pipelines', [/\bdata (?:ingestion|pipelines?|engineering|processing)\b|\betl\b|\belt\b|\bingestion pipelines?\b/i], ['private-rnd', 'fleet-tracker'],
    'Market-data ingestion pipelines (freelance); raw fleet-tracking data turned into tracking APIs at Rocket Flyer.'),
  have('pandas', 'pandas / NumPy', [/\bpandas\b|\bnumpy\b|\bscipy\b/i], ['private-rnd'],
    'pandas, NumPy and SciPy for backtesting and time-series work (freelance).'),
  have('time-series', 'Time series / backtesting', [/\btime[- ]series\b|\bbacktest(?:ing|s)?\b|\balgo(?:rithmic)? trading\b|\btrading systems?\b|\bmarket data\b|\bquantitative\b/i], ['private-rnd'],
    'A multi-engine systematic trading platform: market-data ingestion, backtesting and paper trading (freelance).'),
  near('big-data', 'Spark / big data', [/\b(?:Apache )?Spark\b|\bpyspark\b|\bhadoop\b|\bflink\b|\bdatabricks\b|\bApache Beam\b/i], 0.4, ['private-rnd', 'notify'], 'pandas pipelines (freelance) and Kafka streaming (AT&T).'),
  near('warehouse', 'Data warehouse', [/\bsnowflake\b|\bbigquery\b|\bredshift\b|\bdbt\b|\bdata warehous(?:e|ing)\b|\blakehouse\b/i], 0.4, ['edge-gateway'], 'SQL and PostgreSQL.'),

  // Cloud, build and delivery
  listed('aws', 'AWS', [/\baws\b|\bamazon web services\b/i, /\b(?:EC2|S3|ECS|RDS|CloudWatch|Fargate|Lambda)\b/]),
  near('gcp', 'Google Cloud', [/\bgcp\b|\bgoogle cloud(?: platform)?\b|\bcloud run\b/i], 0.5, ['migrator', 'hub'], 'AWS on the résumé; services on Google’s internal platform for Google Fiber.'),
  near('azure', 'Azure', [/\bazure\b/i], 0.5, ['hub'], 'AWS on the résumé.'),
  listed('cloud', 'Cloud', [/\bcloud[- ]native\b|\bcloud (?:platforms?|services|infrastructure|providers?|environments?|computing)\b|\bpublic cloud\b/i],
    'AWS, Docker and Kubernetes on the résumé; Docker images for AT&T.', ['notify', 'hub']),
  near('serverless', 'Serverless', [/\bserverless\b|\bcloud functions\b|\bazure functions\b/i], 0.3, ['hub'], 'AWS and Docker on the résumé.'),
  have('docker', 'Docker', [/\bdocker\b|\bcontaineri[sz](?:e|ed|ation|ing)\b|\bcontainer (?:images?|platforms?|technolog(?:y|ies))\b/i], ['notify'],
    'Docker images for the AT&T ATLAS platform team.'),
  listed('kubernetes', 'Kubernetes', [/\bkubernetes\b|\bk8s\b|\b(?:eks|gke|aks)\b|\bhelm charts?\b|\bopenshift\b|\bcontainer orchestration\b/i]),
  have('cicd', 'CI/CD', [/\bci\s*\/\s*cd\b|\bcontinuous (?:integration|delivery|deployment)\b|\b(?:build|deployment|release|ci) pipelines?\b/i], ['speech'],
    'Streamlined the FedEx project’s GitHub Actions CI/CD workflows.'),
  have('github-actions', 'GitHub Actions', [/\bgithub actions\b/i], ['speech'],
    'Streamlined the FedEx project’s GitHub Actions CI/CD workflows.'),
  listed('jenkins', 'Jenkins', [/\bjenkins\b/i]),
  near('ci-other', 'Other CI tools', [/\bgitlab[- ]ci\b|\bcircle\s?ci\b|\btravis(?: ci)?\b|\bazure devops\b|\bargo\s?cd\b|\bteamcity\b|\bbamboo\b/i], 0.75, ['speech'], 'GitHub Actions (FedEx) and Jenkins.'),
  listed('git', 'Git', [/\bgit\b|\bversion control\b|\bbitbucket\b/i]),
  near('iac', 'Infrastructure as code', [/\bterraform\b|\binfrastructure[- ]as[- ]code\b|\biac\b|\bcloudformation\b|\bpulumi\b|\bansible\b/i], 0.3, ['notify', 'speech'], 'Docker images and GitHub Actions CI/CD.'),
  have('gradle', 'Gradle', [/\bgradle\b/i], ['migrator'], 'Moved Google Fiber microservices from Blaze to Gradle.'),
  listed('maven', 'Maven', [/\bmaven\b/i]),
  have('bazel', 'Bazel', [/\bbazel\b/i], ['migrator'], 'Converted Google Fiber’s Blaze (Bazel) builds to Gradle.'),
  have('observability', 'Observability', [/\bobservability\b|\bmonitoring\b|\balerting\b|\bdistributed tracing\b|\bopentelemetry\b/i], ['migrator'],
    'Built services under Google’s code-review and observability practices.', 0.85),
  near('obs-tools', 'Monitoring tools', [/\bprometheus\b|\bgrafana\b|\bdatadog\b|\bnew relic\b|\bsplunk\b|\bkibana\b|\bdynatrace\b|\bjaeger\b|\bzipkin\b|\bappdynamics\b/i], 0.5, ['migrator'], 'Google’s observability practices (Google Fiber).'),

  // Security and quality
  have('auth', 'OAuth2 / JWT', [/\boauth\s?2?(?:\.0)?\b|\bjwt\b|\bopenid(?: connect)?\b|\boidc\b|\bsso\b/i], ['edge-gateway', 'notify', 'fleet-tracker'],
    'APIs secured with OAuth2/JWT for Fidelity; Passport.js and Helmet for AT&T; Spring Security at Rocket Flyer.'),
  near('idp', 'Identity providers', [/\bsaml\b|\bkeycloak\b|\bokta\b|\bauth0\b/i], 0.7, ['edge-gateway'], 'OAuth2/JWT (Fidelity), Spring Security and Passport.js.'),
  have('app-security', 'Application security', [/\bapplication security\b|\bsecure coding\b|\bowasp\b|\bweb security\b|\bapi security\b|\bauthentication\b/i], ['edge-gateway', 'notify', 'fleet-tracker'],
    'APIs secured with OAuth2/JWT for Fidelity; Passport.js and Helmet for AT&T; Spring Security at Rocket Flyer.', 0.9),
  listed('testing', 'Automated testing', [/\b(?:unit|integration|end[- ]to[- ]end|automated|api) test(?:s|ing)?\b|\btest[- ]driven\b|\btdd\b|\btest automation\b|\bjunit\b|\bmockito\b|\bjest\b|\btesting frameworks?\b/i],
    'JUnit, Mockito and Jest on the résumé.'),
  near('net-testing', '.NET testing', [/\bxunit\b|\bnunit\b|\bmstest\b/i], 0.5, ['hub'], 'JUnit, Mockito and Jest.'),
  near('ui-testing', 'Browser testing', [/\bselenium\b|\bcypress\b|\bplaywright\b|\bappium\b/i], 0.4, ['hub'], 'Jest, JUnit and Mockito.'),
  have('code-review', 'Code review', [/\bcode reviews?\b|\breview(?:ing)? (?:code|pull requests|prs)\b|\bpull requests?\b|\bclean code\b|\bsolid principles\b|\bengineering best practices\b/i], ['migrator'],
    'Shipped under Google’s code-review and observability practices.'),

  // Front end
  have('angular', 'Angular', [/\bangular(?:js)?\b/i], ['fleet-tracker', 'notify', 'edge-gateway'],
    'Angular dashboards and components at Rocket Flyer, AT&T and Fidelity.'),
  near('react-native', 'React Native', [/\bReact[\s-]Native\b/i], 0.25, ['notify'], 'React web front end (AT&T).'),
  have('react', 'React', [/\bReact(?:\.js|JS)?\b/, /\breact\.?js\b/i], ['notify'], 'React front end for AT&T EFACTS & Syntrac/MLD.'),
  have('rxjs', 'RxJS', [/\brxjs\b/i], ['edge-gateway'], 'RxJS services in Angular consuming the Fidelity APIs.'),
  near('vue', 'Vue / Svelte', [/\bvue(?:\.?js)?\b|\bsvelte(?:kit)?\b|\bember\.?js\b/i], 0.5, ['notify', 'fleet-tracker'], 'Angular and React front ends.'),
  near('nextjs', 'Next.js', [/\bnext\.?js\b|\bnuxt\b/i], 0.6, ['notify'], 'React front end (AT&T).'),
  near('state', 'Redux / NgRx', [/\bredux\b|\bngrx\b|\bzustand\b|\bmobx\b/i], 0.6, ['notify', 'edge-gateway'], 'Angular with RxJS, and React.'),
  have('html-css', 'HTML / CSS', [/\bhtml5?\b|\bcss3?\b|\btailwind\b|\bsass\b|\bscss\b|\bresponsive (?:design|web)\b/i], ['fleet-tracker', 'notify'],
    'Angular and React front ends at Rocket Flyer, AT&T and Fidelity.', 0.85),
  have('maps', 'Maps / geospatial', [/\bleaflet\b|\bmapbox\b|\bgeospatial\b|\bgis\b|\bgps\b|\bmaps? (?:apis?|sdks?)\b|\bgoogle maps\b|\blocation[- ](?:based|tracking|data)\b|\bgeolocation\b/i], ['fleet-tracker'],
    'Live fleet tracking on Leaflet and Mapbox at Rocket Flyer.'),

  // AI and ML
  have('genai', 'LLMs / GenAI', [/\bllms?\b|\blarge language models?\b|\bgenerative ai\b|\bgen\s?-?ai\b|\bfoundation models?\b|\bgpt(?:-?[345]o?)?\b|\bchatgpt\b|\bgemini\b|\bgemma\b|\bllama\b|\bmistral\b|\bqwen\b|\bdeepseek\b/i], ['migrator'],
    'Fine-tuned Google’s Gemma to drive a build-migration agent for Google Fiber; Claude API and Ollama on the résumé.'),
  listed('llm-apis', 'LLM APIs', [/\b(?:openai|anthropic|claude|gemini|bedrock|azure openai)(?: apis?)?\b|\bllm apis?\b|\bollama\b|\bprompt(?:ing| engineering| design)\b|\bfunction calling\b|\btool (?:use|calling)\b|\bstructured outputs?\b/i],
    'LLM API integration (Claude API, Ollama) on the résumé; an LLM-driven migration agent at Google.', ['migrator', 'hub']),
  have('fine-tuning', 'Model fine-tuning', [/\bfine[- ]?tun(?:e|ed|es|ing)\b|\bmodel (?:training|adaptation|customi[sz]ation)\b|\bdomain adaptation\b|\btrain(?:ing)? (?:custom |deep learning |ml )?models\b/i], ['migrator', 'speech', 'private-rnd'],
    'Fine-tuned Gemma for Google Fiber and NVIDIA Nemotron speech models for FedEx; training a Hindi text-to-speech engine.'),
  have('agents', 'AI agents', [/\b(?:ai|llm|autonomous) agents?\b|\bagentic\b|\bmulti-?agent\b|\bagent (?:frameworks?|orchestration|workflows?|systems?|platform)\b/i], ['migrator'],
    'Led the team behind the build-migration agent in a 30–40+ agent n8n pipeline for Google Fiber.'),
  near('agent-frameworks', 'Agent frameworks', [/\blangchain\b|\blanggraph\b|\bllama\s?index\b|\bcrew\s?ai\b|\bautogen\b|\bsemantic kernel\b|\bhaystack\b|\bdspy\b|\bmodel context protocol\b|\bMCP\b/i], 0.6, ['migrator'],
    'Multi-agent orchestration on n8n (Google Fiber); Claude API and Ollama.'),
  have('n8n', 'n8n / workflow automation', [/\bn8n\b|\bworkflow (?:automation|orchestration)\b/i], ['migrator'],
    'An n8n pipeline of 30–40+ AI agents for the Google Fiber migration.'),
  near('orchestrators', 'Workflow schedulers', [/\bzapier\b|\bmake\.com\b|\bairflow\b|\bdagster\b|\bprefect\b|\bstep functions\b/i], 0.5, ['migrator'], 'Workflow orchestration on n8n (Google Fiber).'),
  near('rag', 'RAG', [/\bRAG\b/, /\bretrieval[- ]augmented\b|\bsemantic search\b/i], 0.5, ['migrator', 'hub'], 'LLM fine-tuning and LLM API integration (Claude API, Ollama).'),
  near('vector', 'Vector databases', [/\bvector (?:databases?|dbs?|stores?|search|indexes?)\b|\bembeddings?\b|\bpinecone\b|\bweaviate\b|\bqdrant\b|\bmilvus\b|\bpgvector\b|\bchroma(?:db)?\b|\bfaiss\b/i], 0.4, ['migrator', 'edge-gateway'],
    'LLM fine-tuning and API integration; PostgreSQL in production.'),
  have('ml', 'AI / machine learning', [/\bmachine learning\b|\bdeep learning\b|\bneural networks?\b|\bml models?\b|\bml engineering\b|\bai\/ml\b|\bml\/ai\b|\bartificial intelligence\b/i, /(?<![\w/])(?:AI|ML)(?![\w/])/], ['migrator', 'speech', 'private-rnd'],
    'Production ML: Gemma fine-tuning for Google, NVIDIA Nemotron speech models for FedEx, a Hindi text-to-speech engine (freelance).'),
  have('pytorch', 'PyTorch', [/\bpytorch\b|\btorch(?:audio|vision)?\b/i], ['speech', 'private-rnd'],
    'PyTorch for the FedEx speech-to-text models and the VAAK text-to-speech engine.'),
  near('ml-frameworks', 'TensorFlow / scikit-learn', [/\btensorflow\b|\bkeras\b|\bjax\b|\bscikit[- ]learn\b|\bsklearn\b|\bxgboost\b/i], 0.6, ['speech', 'private-rnd'], 'PyTorch (FedEx speech models, VAAK).'),
  have('huggingface', 'Hugging Face', [/\bhugging\s?face\b|\btransformers\b/i], ['private-rnd'],
    'Hugging Face and a custom SentencePiece tokenizer for the VAAK text-to-speech engine.'),
  have('asr', 'Speech recognition', [/\bspeech[- ]to[- ]text\b|\basr\b|\bspeech recognition\b|\bstt\b|\bvoice (?:ai|recognition|assistants?|agents?|bots?)\b|\baudio (?:ml|models?|processing)\b|\bspeech (?:models?|ai|processing|technology)\b|\bwhisper\b/i], ['speech'],
    'Fine-tuned NVIDIA Nemotron speech models on a Parakeet base for FedEx speech-to-text.'),
  have('tts', 'Text-to-speech', [/\btext[- ]to[- ]speech\b|\btts\b|\bspeech synthesis\b|\bvoice (?:synthesis|cloning|generation)\b/i], ['private-rnd'],
    'Building VAAK, an expressive Hindi text-to-speech engine trained on a 5,000+ hour corpus.'),
  have('nlp', 'NLP', [/\bnlp\b|\bnatural language (?:processing|understanding)\b|\bnlu\b|\btext classification\b/i], ['migrator', 'speech', 'private-rnd'],
    'Language and speech models: Gemma fine-tuning, FedEx speech recognition, a custom SentencePiece tokenizer for VAAK.', 0.85),
  near('mlops', 'MLOps / model serving', [/\bmlops\b|\bllmops\b|\bmodel (?:deployment|serving|monitoring|registry)\b|\binference (?:optimi[sz]ation|serving|servers?)\b|\bvllm\b|\btriton\b|\bkubeflow\b|\bmlflow\b|\bsagemaker\b|\bvertex ai\b|\bonnx\b|\btensorrt\b/i], 0.6, ['speech', 'migrator'],
    'Fine-tuned models shipped into the Google Fiber and FedEx pipelines; GitHub Actions CI/CD.'),
  none('vision', 'Computer vision', [/\bcomputer vision\b|\bobject detection\b|\bimage (?:classification|recognition|segmentation)\b|\bopencv\b|\byolo\b/i]),

  // Ways of working
  have('leadership', 'Technical leadership', [/\btech(?:nical)? lead\b|\bteam lead\b|\blead(?:ing)? (?:a |the |small )?(?:team|squad|engineers|developers|pod)\b|\bleadership\b|\bmentor(?:ing|ship|s|ed)?\b|\bcoach(?:ing)? (?:junior|engineers|developers)\b|\bpeople management\b|\bmanag(?:e|ing) (?:a )?(?:small )?team\b/i], ['migrator', 'speech'],
    'Team Lead at Accenture: led a 5–6 engineer team for Google Fiber and owned work allocation for the FedEx team.'),
  have('stakeholders', 'Communication and stakeholders', [/\bstakeholders?\b|\bclient[- ]facing\b|\bcustomer[- ]facing\b|\bcommunication skills\b|\b(?:written|verbal|clear) communication\b|\bcross[- ]functional\b|\bwork(?:ing)? (?:closely )?with (?:product|clients?|customers|designers)\b|\bproduct managers?\b/i], ['speech'],
    'Development Enabler for FedEx: coordinated priorities with the client team. Delivered for AT&T, Fidelity and Google through service companies.'),
  have('migration', 'Migration and modernisation', [/\bmigrat(?:e|es|ed|ion|ions|ing)\b|\bmoderni[sz](?:e|ed|ation|ing)\b|\blegacy (?:code|systems?|services?|applications?|platforms?)\b|\bre-?platform(?:ing)?\b/i], ['migrator'],
    'Migrated Google Fiber microservices from Blaze to Gradle with an LLM-driven agent.'),

  // Domains: matched when a JD names one; a domain he has not worked in is simply not counted.
  have('fintech', 'Financial services', [/\bfintech\b|\bfinancial services\b|\bfinance\b|\bbanking\b|\bpayments?\b|\btrading\b|\binvestments?\b|\basset management\b|\bwealth management\b|\bcapital markets\b|\blending\b|\bpayouts?\b|\bledgers?\b/i], ['edge-gateway', 'fleet-tracker', 'private-rnd'],
    'Fidelity International (asset management) at Publicis Sapient; a loan-application platform at Rocket Flyer; a systematic trading platform (freelance).'),
  have('telecom', 'Telecom', [/\btelecom(?:munications)?\b|\btelco\b|\bnetwork operators?\b/i], ['notify'], 'AT&T, through Tech Mahindra (2019–21).'),
  have('logistics', 'Logistics and mobility', [/\blogistics\b|\bsupply[- ]chain\b|\bshipping\b|\bfreight\b|\bparcels?\b|\blast[- ]mile\b|\bfleets?\b|\bmobility\b|\bride[- ]?(?:hailing|sharing)\b|\bcar rental\b/i], ['speech', 'fleet-tracker'],
    'FedEx speech-to-text for operations; fleet management and live tracking at Rocket Flyer.'),
];

for (const x of SYMBOLS) if (x.id === 'fintech' || x.id === 'telecom' || x.id === 'logistics') x.domain = true;

export const SYMBOL_INDEX = new Map(SYMBOLS.map((x, i) => [x, i]));

export interface Sample { id: string; label: string; text: string; }

/** Sample job descriptions for visitors without one to hand. Written for this site, not copied from real postings. */
export const SAMPLES: Sample[] = [
  {
    id: 'java-fintech',
    label: 'Java backend · fintech',
    text: `Senior Backend Engineer (Java)
Remote · Full-time

About the role
We run the ledger and payout services that move money for two million merchants. You will own core services end to end, from design to production.

What you'll do
- Design, build and run Java microservices on Spring Boot
- Build event-driven flows on Kafka between the ledger, payouts and risk services
- Design REST APIs that partner teams can rely on, secured with OAuth2
- Keep services fast and reliable: caching with Redis, PostgreSQL tuning, monitoring
- Review code and mentor two or three engineers

What we're looking for
- 6+ years of backend engineering experience, mostly in Java
- Strong Spring Boot and microservices experience
- Hands-on with Kafka or another message broker
- PostgreSQL and SQL data modelling
- Docker and Kubernetes; CI/CD with GitHub Actions or Jenkins
- Unit and integration testing with JUnit and Mockito

Nice to have
- Experience in fintech or financial services
- Kotlin
- AWS
- gRPC`,
  },
  {
    id: 'ai-llm',
    label: 'AI / LLM engineer',
    text: `AI Engineer, LLM Platform
Remote (EU or US time-zone overlap) · Contract or full-time

You will build the agent platform behind our product: LLM-powered workflows that read documents, call tools and hand work back to people.

Responsibilities
- Build and ship AI agents and multi-agent workflows in production
- Fine-tune open models (Llama, Gemma, Mistral) and evaluate them on our own tasks
- Integrate LLM APIs (OpenAI, Anthropic) behind reliable Python services
- Build retrieval-augmented generation (RAG) pipelines over customer documents
- Work with product and customers to turn fuzzy problems into shipped features

Requirements
- 4+ years of software engineering experience, including Python in production
- Hands-on model fine-tuning with PyTorch and Hugging Face
- Agent orchestration with LangChain, LangGraph, n8n or similar
- Solid backend fundamentals: REST APIs, Docker, CI/CD
- Clear written communication in a remote team

Nice to have
- Vector databases (pgvector, Pinecone)
- Speech or audio models
- Java or Kotlin backend experience`,
  },
  {
    id: 'fullstack',
    label: 'Full-stack Node + React',
    text: `Full-Stack Engineer (Node.js / React)
Hybrid or remote · Full-time

What you'll do
- Build features across a NestJS / Node.js backend and a React + TypeScript front end
- Design REST and GraphQL APIs
- Own services that use Redis, PostgreSQL and MongoDB
- Write tests with Jest and ship through CI/CD
- Work closely with designers and product managers

Must have
- 5+ years of experience building web applications
- Node.js and TypeScript
- React (Next.js is a plus)
- REST API design
- SQL and NoSQL databases

Nice to have
- Angular
- Docker and AWS
- Event-driven systems with Kafka`,
  },
];
