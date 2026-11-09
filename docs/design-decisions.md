# Design decisions

Short notes on why the site looks the way it does.

## 1. A résumé drawn as a distributed system

A résumé is a projection: a view computed from a history of events (joined, shipped, migrated, led). Drawing it as services publishing to a Kafka log, with a hub that folds the log into a résumé, makes that idea visible — and it is the kind of system I build for a living.

## 2. One language per module

Each chapter used a different stack, so each module is drawn in that runtime: two JVM modules (Spring Boot and Vert.x) next to Kotlin coroutines, Node's event loop and CPython. Opening a module shows that runtime's real internals: G1 heap regions and the JIT tiers, libuv's six phases, Vert.x multi-reactor loops, the coroutine state machine, the CPython eval loop.

## 3. The hub keeps the decision log

The first version of the hub page explained a metaphor: lexer, parser, type checker, optimiser and code generator, mapped onto writing a résumé. It told a visitor nothing the résumé did not. Senior engineers are judged on trade-offs, so the hub now holds what a résumé cannot: a decision record for each significant choice (context, options, decision, consequences), placed on a trace of the career.

The compiler idea stayed where it is literally true. The JD compiler is a real lex → parse → link → score pipeline, and the hub page shows each stage's actual output, in the spirit of Compiler Explorer.

## 4. Real bytecode

The bytecode panels come from compiling the files in `runtime-samples/` (`javap -c`, `node --print-bytecode`, `dis`). Diagrams are easy to draw; the panels show what the runtimes really execute.

## 5. SVG instead of WebGL

The scenes are crisp lines, labels and small animated parts. SVG keeps text sharp, is accessible (focusable modules, ARIA labels), runs on phones, and needs no 3D engine. The isometric projection is one small function (`web/src/scene/iso.ts`).

## 6. Cheap to repaint

The scenes animate every frame, so every glow is a pre-drawn gradient rather than a blur filter, shapes are updated in place instead of re-created, and animations pause when scrolled out of view.

Anything that moves all the time animates only `transform` or `opacity`, which the browser runs on its compositor thread: no script, style or paint work per frame. That includes the hub's consumer and its RGB strip. The sorter's 12-second loop is generated once as keyframes, and the strip is a repeating gradient sliding under a clip shape. I measured it in headless Edge: an idle home page asks the main thread for no frames at all, and adding the hub cost nothing measurable over a page with one blinking LED. A version that moved things from a 30 Hz JavaScript timer looked the same but repainted the scene on every tick and cost more, so it was dropped.

The career log loops, so its particles had to be cheap too. Each particle's flight is sampled into keyframes when it is sent and handed to the browser as one animation. A burst's stagger lives inside the keyframes, not in animation delays, so its seven animations start in one frame and end in one frame; every start and end costs a main-thread frame. The ring's flowing dashes are a dashed circle rotated on the ring's plane, not an animated dash offset. Measured in headless Edge while the log plays, main-thread time fell from 460 to about 65 ms a second and GPU time from 256 to about 50.

## 7. Two themes, one set of tokens

Every colour that changes between light and dark is a CSS custom property, including the colours inside the SVG scenes, so a theme switch is one attribute on `<html>`.
