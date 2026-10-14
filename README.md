# Virtuality benchmark

A fixed-height table benchmark comparing **TanStack Virtual**, **virtua**, and **react-window** using **Preact's React compatibility layer**. Each implementation uses the same 200,000-record dataset, six columns, 42px rows, a 420px viewport, and 720px-wide row content.

## Run locally

```bash
bun install
bun run dev
```

For runtime measurements, use the production build:

```bash
bun run build
bun run preview
```

Open the preview URL, normally `http://localhost:4173`. Scroll a panel manually, toggle **Sync scroll**, or select **Run scroll benchmark**. Keep the tab visible, avoid input during a run, and use a wide window with all three panels visible. Developer tools, background work, and off-screen panels can affect the results.

The dev and preview servers send `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. The page is then cross-origin isolated, and `performance.now()` resolves to 5µs instead of 100µs. Serving `dist` from another server without these headers coarsens the samples.

## Benchmark report — October 14, 2026

### Scroll performance

Five production-preview runs, driven by Playwright in a headed Chromium 153.0.8010.12 window on Windows 10 (Intel Core i5-12500, 60Hz, 1600×1000 viewport, DPR 1, cross-origin isolated). Each run has 54 timed jumps per engine after warm-up, so every engine has 270 samples.

| Implementation | Rows in DOM | Mean JS | Mean full frame | Median | p95 | Run means |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TanStack Virtual | 26.5 | 1.74 ms | 5.90 ms | 6.02 ms | 8.22 ms | 5.45–6.40 ms |
| virtua `Virtualizer` | 18.3 | 1.75 ms | 5.90 ms | 6.19 ms | 8.30 ms | 5.47–6.21 ms |
| react-window `List` | 26.3 | 2.06 ms | 6.26 ms | 6.42 ms | 8.71 ms | 5.70–6.56 ms |

![Scroll benchmark: mean JS, mean and p95 full-frame main-thread time, milliseconds; lower is better](docs/scroll-performance.svg)

**Interpretation:** every engine finishes a 200,000-row jump in about a third of a 60Hz frame. TanStack and virtua are indistinguishable. react-window is about 0.3ms slower in JS. Its JS mean was highest in four of five runs. The per-run full-frame means overlap for all three engines. Style, layout and paint take about 4.2ms in each engine and dominate the frame. virtua keeps fewer rows in the DOM, but this does not measurably shorten its frame here. There is no meaningful overall speed winner on this hardware.

**Metric:** a capture-phase `scroll` listener on `window` records the start. It runs before the engine's own listener on the scroller. A `requestAnimationFrame` callback requested in that listener runs in the same frame and marks the end of the JS phase: scroll handlers and the Preact commit. A `MessageChannel` message posted from that callback runs as the next task, after the frame's style, layout, resize observers and paint. It marks the end of the full frame. After each jump the first visible row MUST be the expected index. Otherwise the run is discarded, so a deferred or blank frame cannot pass as fast.

The metric excludes idle time before vsync, raster and compositor threads, and GPU work. It does not measure sustained-scroll FPS or continuous wheel scrolling: the workload consists of 18 large forward jumps per pass.

The earlier report measured from `scrollTop` assignment to the second following `requestAnimationFrame`. That interval is two vsync periods whenever the work fits in a frame, so every engine scored about 33.3ms on a 60Hz display. It measured the refresh rate, not the libraries.

Raw per-jump samples, per-run statistics and the environment are in [docs/scroll-results.json](docs/scroll-results.json). The chart uses exactly those values.

### Minified and gzip size

These are **actual emitted JavaScript chunk sizes**, not npm package download sizes or sums of independently compressed modules. The analysis build isolates each library and shared dependencies into separate chunks while retaining the imports used by this application and tree-shaking unused exports. TanStack includes both its React adapter and virtual core; virtua includes `Virtualizer`; react-window includes `List`.

<!-- bundle-sizes:start -->
| Library / shared dependency | Minified bytes | Gzip bytes (level 9) |
| --- | ---: | ---: |
| @tanstack/react-virtual + @tanstack/virtual-core | 26,848 | 8,010 |
| virtua (Virtualizer) | 7,384 | 3,876 |
| react-window (List) | 10,712 | 4,009 |
| Shared Preact runtime | 17,806 | 7,276 |
| Shared signals | 7,764 | 2,965 |
<!-- bundle-sizes:end -->

Versions measured: `@tanstack/react-virtual` 3.14.19 + `@tanstack/virtual-core` 3.19.4, `virtua` 0.53.5, `react-window` 2.3.4, `preact` 11.0.1, and `@preact/signals` 2.11.3. Exact versions and byte counts are retained in [docs/bundle-sizes.json](docs/bundle-sizes.json).

**Interpretation:** virtua has the smallest library chunk both minified and gzipped. react-window is close after compression. TanStack is largest in both measures for the APIs imported here. Shared Preact/compat and signals are listed separately and should not be charged to each library independently.

Sizes include chunk import/export glue and exclude source maps, CSS, HTML, and application code. Gzip uses level 9, matching visualizer; Vite's console can show slightly different gzip numbers because its compression settings differ. Splitting changes minification and compression boundaries, so these values are not exact marginal contributions to the normal single-bundle build, nor total sizes of standalone applications. They quantify the library chunks in this analytical build.

## Visualizer: rendered, gzip, and Brotli

```bash
bun run analyze
bun run preview
```

Open [the chunk size report](http://localhost:4173/bundle-stats.html). Select **Gzip** in its size controls to compare compressed sizes, or hover a chunk to inspect its rendered, gzip, and Brotli values. The libraries have named chunks; shared Preact and signals have their own chunks. The report's rendered size is the minified emitted chunk's UTF-8 byte size.

A separate [module attribution report](http://localhost:4173/bundle-modules.html) shows source-map attribution within those chunks. It is uncompressed only: the installed `rollup-plugin-visualizer` 7.1.1 explicitly disables gzip/Brotli calculation in source-map mode. The main report instead measures complete emitted chunks with source-map attribution disabled, so compression values are real and non-zero.

`bun run analyze` also checks visualizer's values against the files using Node's gzip level 9, saves `docs/bundle-sizes.json`, and refreshes the size table above. Only analytical builds split library chunks; use `bun run build` for runtime benchmarking. Either build replaces `dist`, so a normal build removes the analytical HTML reports.

## Measurement isolation

- The dataset is created once and shared across all implementations.
- Memoized table adapters receive stable registration and scroll callbacks. react-window receives a stable row component and row props; TanStack's size/key callbacks and virtua's row renderer are stable too.
- Row counters use `@preact/signals` to update only their own components. Their 250ms sampling timer and DOM scans are disabled during benchmark runs. Scroll handlers do not count DOM rows.
- A dedicated benchmark flag disables scroll synchronization throughout warm-up, measurements, and reset. A pending manual-sync callback cannot release that flag.
- Each engine is warmed up first. Three rounds rotate the order: TanStack → virtua → react-window; virtua → react-window → TanStack; react-window → TanStack → virtua.
- Each round has 18 non-zero jumps per engine. All adapters use native `scrollTop`; target positions use the smallest actual scroll range across the three panels. There are 200ms settling periods between passes for pending scroll-end work.
- Each jump starts one frame after the previous one finished. Row counting and the visible-row check run after the end mark.
- Results are published once after all 162 timed jumps. Median and p95 use the nearest-rank definition.
- Keyboard/pointer/touch/wheel input, window resizing, a visibility change, a missing scroll event, or a wrong first visible row invalidates a run. Partial results are discarded. A hidden tab may finish cancellation only after rAF resumes.
- The three tables remain mounted, but only the measured one scrolls.
- Overscan policies differ by design. TanStack and react-window render eight rows on both sides. virtua's 336px `bufferSize` applies only in the scroll direction while scrolling, and on both sides at rest. The benchmark records rendered rows with every sample instead of forcing equal counts.

This benchmark compares the chosen adapters under Preact compatibility. It does not establish how the libraries compare under native React, variable-height rows, continuous scrolling, different overscan policies, or different devices.

## Regenerate the chart

The checked-in chart is a static SVG generated from the recorded results:

```bash
python -m pip install matplotlib
python scripts/plot-scroll.py
```

Running this command redraws the recorded runs; it does not execute a new browser benchmark. To publish new runs, collect the `data-results` attribute of the benchmark strip after each run, replace the values and provenance in `docs/scroll-results.json`, then update the performance table and regenerate the chart.
