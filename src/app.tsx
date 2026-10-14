import { memo } from 'preact/compat'
import { signal, type Signal } from '@preact/signals'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  List,
  type RowComponentProps,
  type ListImperativeAPI,
} from 'react-window'
import { Virtualizer } from 'virtua'
import './app.css'

const ROW_COUNT = 200_000
const ROW_HEIGHT = 42
const VIEWPORT_HEIGHT = 420
const OVERSCAN = 8

type EngineId = 'tanstack' | 'virtua' | 'react-window'
type RowData = {
  id: number
  name: string
  department: string
  status: string
  amount: string
  updated: string
}
type EngineController = { getElement: () => HTMLElement | null }
type ScrollHandler = (id: EngineId, offset: number) => void

const engines: Array<{
  id: EngineId
  name: string
  eyebrow: string
  detail: string
  color: string
}> = [
  {
    id: 'tanstack',
    name: '@tanstack/react-virtual',
    eyebrow: 'Headless',
    detail: 'Полный контроль над DOM и layout',
    color: '#55d6be',
  },
  {
    id: 'virtua',
    name: 'virtua',
    eyebrow: 'Components',
    detail: 'Virtualizer с ленивым рендерингом строк',
    color: '#f4b860',
  },
  {
    id: 'react-window',
    name: 'react-window',
    eyebrow: 'Components',
    detail: 'Классический List с фиксированной высотой',
    color: '#ff7b9c',
  },
]
const departments = [
  'Platform',
  'Design',
  'Growth',
  'Operations',
  'Security',
  'Research',
]
const statuses = ['Active', 'Review', 'Queued', 'Paused']

function createRows(): RowData[] {
  return Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: index + 1,
    name: `Record ${String(index + 1).padStart(6, '0')}`,
    department: departments[index % departments.length],
    status: statuses[index % statuses.length],
    amount: `$${(1240 + ((index * 791) % 48_000)).toLocaleString('en-US')}`,
    updated: `${(index % 28) + 1} Sep 2026`,
  }))
}

function TableHeader() {
  return (
    <div class="table-header" role="row">
      <span>ID</span>
      <span>Record</span>
      <span>Department</span>
      <span>Status</span>
      <span>Value</span>
      <span>Updated</span>
    </div>
  )
}

function TableCells({ row, index }: { row: RowData; index: number }) {
  return (
    <>
      <span class="cell-id">{String(index + 1).padStart(6, '0')}</span>
      <span class="cell-name">{row.name}</span>
      <span>{row.department}</span>
      <span>
        <i class={`status-dot status-${row.status.toLowerCase()}`} />
        {row.status}
      </span>
      <span class="cell-value">{row.amount}</span>
      <span class="cell-date">{row.updated}</span>
    </>
  )
}

const TanstackTable = memo(function TanstackTable({
  data,
  onScroll,
  register,
}: {
  data: RowData[]
  onScroll: ScrollHandler
  register: (controller: EngineController) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => rootRef.current, [])
  const estimateSize = useCallback(() => ROW_HEIGHT, [])
  const getItemKey = useCallback((index: number) => data[index].id, [data])
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement,
    estimateSize,
    overscan: OVERSCAN,
    getItemKey,
  })
  const reportScroll = useCallback(() => {
    const element = rootRef.current
    if (element) onScroll('tanstack', element.scrollTop)
  }, [onScroll])
  useLayoutEffect(() => {
    register({ getElement: () => rootRef.current })
  }, [register])
  return (
    <div
      ref={rootRef}
      class="table-scroll"
      onScroll={reportScroll}
      role="rowgroup"
    >
      <div
        class="table-canvas"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            class="table-row"
            data-row
            data-index={item.index}
            role="row"
            key={item.key}
            style={{
              transform: `translateY(${item.start}px)`,
              height: `${ROW_HEIGHT}px`,
            }}
          >
            <TableCells row={data[item.index]} index={item.index} />
          </div>
        ))}
      </div>
    </div>
  )
})

const VirtuaTable = memo(function VirtuaTable({
  data,
  onScroll,
  register,
}: {
  data: RowData[]
  onScroll: ScrollHandler
  register: (controller: EngineController) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const reportScroll = useCallback(
    (offset: number) => {
      onScroll('virtua', offset)
    },
    [onScroll],
  )
  useLayoutEffect(() => {
    register({ getElement: () => viewportRef.current })
  }, [register])
  const renderRow = useCallback(
    (row: RowData, index: number) => (
      <div
        key={row.id}
        class="table-row"
        data-row
        data-index={index}
        role="row"
      >
        <TableCells row={row} index={index} />
      </div>
    ),
    [],
  )
  return (
    <div class="virtua-host" role="rowgroup">
      <div ref={viewportRef} data-engine="virtua" class="table-scroll">
        <Virtualizer
          scrollRef={viewportRef}
          data={data}
          itemSize={ROW_HEIGHT}
          bufferSize={ROW_HEIGHT * OVERSCAN}
          onScroll={reportScroll}
        >
          {renderRow}
        </Virtualizer>
      </div>
    </div>
  )
})

const ReactWindowTable = memo(function ReactWindowTable({
  data,
  onScroll,
  register,
}: {
  data: RowData[]
  onScroll: ScrollHandler
  register: (controller: EngineController) => void
}) {
  const rootRef = useRef<ListImperativeAPI | null>(null)
  const getRoot = useCallback(() => rootRef.current?.element ?? null, [])
  const rowProps = useMemo(() => ({ data }), [data])
  const reportScroll = useCallback(
    (event: Event) => {
      const element = event.currentTarget as HTMLElement
      onScroll('react-window', element.scrollTop)
    },
    [onScroll],
  )
  useLayoutEffect(() => {
    register({ getElement: getRoot })
  }, [getRoot, register])
  return (
    <List
      listRef={rootRef}
      className="table-scroll"
      defaultHeight={VIEWPORT_HEIGHT}
      rowCount={data.length}
      rowHeight={ROW_HEIGHT}
      overscanCount={OVERSCAN}
      rowProps={rowProps}
      onScroll={reportScroll}
      rowComponent={WindowRow}
    />
  )
})

function WindowRow({
  index,
  style,
  data,
}: RowComponentProps<{ data: RowData[] }>) {
  return (
    <div
      class="table-row"
      data-row
      data-index={index}
      role="row"
      style={style}
    >
      <TableCells row={data[index]} index={index} />
    </div>
  )
}

function RowCount({ count }: { count: Signal<number> }) {
  return <>{String(count.value).padStart(2, '0')}</>
}

type BenchmarkResult = {
  average: number
  script: number
  median: number
  p95: number
  rows: number
  samples: JumpSample[]
}

function EngineCard({
  engine,
  data,
  onScroll,
  register,
  renderedRows,
  result,
}: {
  engine: (typeof engines)[number]
  data: RowData[]
  onScroll: ScrollHandler
  register: (controller: EngineController) => void
  renderedRows: Signal<number>
  result?: BenchmarkResult
}) {
  return (
    <article class="engine-card" style={{ '--engine-color': engine.color }}>
      <div class="engine-card-head">
        <div>
          <div class="engine-eyebrow">
            <span class="engine-mark" />
            {engine.eyebrow}
          </div>
          <h2>{engine.name}</h2>
          <p>{engine.detail}</p>
        </div>
        <div class="engine-number">
          <RowCount count={renderedRows} />
          <small> rows</small>
        </div>
      </div>
      <TableHeader />
      <div class="engine-table">
        {engine.id === 'tanstack' && (
          <TanstackTable data={data} onScroll={onScroll} register={register} />
        )}
        {engine.id === 'virtua' && (
          <VirtuaTable data={data} onScroll={onScroll} register={register} />
        )}
        {engine.id === 'react-window' && (
          <ReactWindowTable
            data={data}
            onScroll={onScroll}
            register={register}
          />
        )}
      </div>
      <div class="engine-card-foot">
        <span>fixed row · {ROW_HEIGHT}px</span>
        {result ? (
          <strong>
            {result.average.toFixed(2)} ms avg · {result.rows.toFixed(0)} rows
          </strong>
        ) : (
          <span>ready</span>
        )}
      </div>
    </article>
  )
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function countRows(element: HTMLElement) {
  return element.querySelectorAll('[data-row]').length
}

function firstVisibleIndex(element: HTMLElement) {
  const top = element.getBoundingClientRect().top + 0.5
  for (const row of element.querySelectorAll<HTMLElement>('[data-row]')) {
    const box = row.getBoundingClientRect()
    if (box.top <= top && box.bottom > top) return Number(row.dataset.index)
  }
  return -1
}

type JumpSample = { duration: number; script: number; rows: number }

// Times the main-thread work of one frame: from scroll event dispatch until
// that frame's rendering is done. Idle time before vsync is excluded.
// `script` ends at the frame's rAF: scroll handlers and the resulting commit.
function measureJump(element: HTMLElement, position: number) {
  return new Promise<JumpSample>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout)
      window.removeEventListener('scroll', begin, true)
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Scroll event did not arrive.'))
    }, 1000)
    // A capture listener on window runs before the engine's listener on the scroller.
    const begin = (event: Event) => {
      if (event.target !== element) return
      cleanup()
      const start = performance.now()
      // rAF requested during scroll dispatch runs in the same frame; the posted
      // message runs as the next task, after style, layout, observers and paint.
      requestAnimationFrame(() => {
        const script = performance.now() - start
        const channel = new MessageChannel()
        channel.port1.onmessage = () => {
          const duration = performance.now() - start
          const expected = Math.floor(position / ROW_HEIGHT)
          const actual = firstVisibleIndex(element)
          if (actual !== expected)
            reject(
              new Error(
                `Rows not committed in the scroll frame: expected ${expected}, saw ${actual}.`,
              ),
            )
          else resolve({ duration, script, rows: countRows(element) })
        }
        channel.port2.postMessage(null)
      })
    }
    window.addEventListener('scroll', begin, { capture: true, passive: true })
    element.scrollTop = position
  })
}

export function App() {
  const data = useMemo(createRows, [])
  const controllers = useRef<Partial<Record<EngineId, EngineController>>>({})
  const getElement = (id: EngineId) => controllers.current[id]?.getElement()
  const scrollTo = (id: EngineId, offset: number) => {
    const element = getElement(id)
    if (element) element.scrollTop = offset
  }
  const syncing = useRef(false)
  const benchmarking = useRef(false)
  const syncEnabled = useRef(true)
  const [syncScroll, setSyncScroll] = useState(true)
  const renderedRows = useMemo(
    () => ({
      tanstack: signal(0),
      virtua: signal(0),
      'react-window': signal(0),
    }),
    [],
  )
  const [results, setResults] = useState<
    Partial<Record<EngineId, BenchmarkResult>>
  >({})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const registrations = useMemo(
    () =>
      Object.fromEntries(
        engines.map(({ id }) => [
          id,
          (controller: EngineController) => {
            controllers.current[id] = controller
          },
        ]),
      ) as Record<EngineId, (controller: EngineController) => void>,
    [],
  )
  // Counters update independently, never walking the DOM inside a scroll handler or timed pass.
  useEffect(() => {
    if (running) return
    const timer = window.setInterval(() => {
      if (benchmarking.current) return
      for (const { id } of engines) {
        const element = getElement(id)
        renderedRows[id].value = element ? countRows(element) : 0
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [renderedRows, running])
  const handleScroll = useCallback<ScrollHandler>((id, offset) => {
    if (benchmarking.current || !syncEnabled.current || syncing.current) return
    syncing.current = true
    engines.forEach(({ id: targetId }) => {
      if (targetId !== id) scrollTo(targetId, offset)
    })
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }, [])
  const runBenchmark = useCallback(async () => {
    if (benchmarking.current) return
    benchmarking.current = true
    setRunning(true)
    setResults({})
    setError('')
    let invalid = document.hidden
    const invalidate = () => {
      invalid = true
    }
    const check = () => {
      if (invalid)
        throw new Error(
          'Run discarded: visibility, viewport or input changed. Please retry.',
        )
    }
    document.addEventListener('visibilitychange', invalidate)
    window.addEventListener('resize', invalidate)
    window.addEventListener('wheel', invalidate, {
      passive: true,
      capture: true,
    })
    window.addEventListener('touchstart', invalidate, {
      passive: true,
      capture: true,
    })
    window.addEventListener('pointerdown', invalidate, true)
    window.addEventListener('keydown', invalidate, true)
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      await nextFrame()
      check()
    }
    const samples: Record<EngineId, JumpSample[]> = {
      tanstack: [],
      virtua: [],
      'react-window': [],
    }
    try {
      // Finish UI commits, pending sync events and scroll-end timers before warming up.
      await settle()
      const elements = Object.fromEntries(
        engines.map(({ id }) => {
          const element = getElement(id)
          if (!element) throw new Error(`Engine not ready: ${id}`)
          return [id, element]
        }),
      ) as Record<EngineId, HTMLElement>
      const maxScroll = Math.min(
        ...engines.map(
          ({ id }) => elements[id].scrollHeight - elements[id].clientHeight,
        ),
      )
      if (maxScroll <= 0) throw new Error('Scrollable viewport is not ready.')
      const positions = Array.from({ length: 18 }, (_, index) =>
        Math.round((maxScroll * (index + 1)) / 18),
      )
      for (const { id } of engines) {
        for (const position of [0, maxScroll / 2, maxScroll, 0]) {
          elements[id].scrollTop = position
          await nextFrame()
          await nextFrame()
          check()
        }
        await settle()
      }
      // Each engine occupies each order slot once. Publish only after all timed work ends.
      for (let round = 0; round < engines.length; round++) {
        for (let slot = 0; slot < engines.length; slot++) {
          const { id } = engines[(round + slot) % engines.length]
          elements[id].scrollTop = 0
          await settle()
          for (const position of positions) {
            await nextFrame()
            check()
            const sample = await measureJump(elements[id], position)
            check()
            samples[id].push(sample)
          }
          await settle()
        }
      }
      const nextResults: Partial<Record<EngineId, BenchmarkResult>> = {}
      for (const { id } of engines) {
        const values = samples[id].map((sample) => sample.duration)
        const sorted = [...values].sort((a, b) => a - b)
        const mean = (list: number[]) =>
          list.reduce((sum, value) => sum + value, 0) / list.length
        nextResults[id] = {
          samples: samples[id],
          average: mean(values),
          script: mean(samples[id].map((sample) => sample.script)),
          median: sorted[Math.ceil(sorted.length * 0.5) - 1],
          p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
          rows: mean(samples[id].map((sample) => sample.rows)),
        }
      }
      setResults(nextResults)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      engines.forEach(({ id }) => scrollTo(id, 0))
      await new Promise((resolve) => setTimeout(resolve, 200))
      document.removeEventListener('visibilitychange', invalidate)
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('wheel', invalidate, true)
      window.removeEventListener('touchstart', invalidate, true)
      window.removeEventListener('pointerdown', invalidate, true)
      window.removeEventListener('keydown', invalidate, true)
      syncing.current = false
      benchmarking.current = false
      setRunning(false)
    }
  }, [])
  return (
    <main class="app-shell">
      <header class="hero-section">
        <div class="topline">
          <span class="signal" />
          RUNTIME LAB <span class="topline-muted">/ VIRTUALIZATION</span>
        </div>
        <div class="hero-grid">
          <div>
            <h1>
              Three ways to move
              <br />
              <em>200,000 rows.</em>
            </h1>
            <p class="hero-copy">
              A small, hands-on benchmark for fixed-height tables. Same data,
              same viewport, three different virtualization engines.
            </p>
          </div>
          <div class="hero-stats">
            <div>
              <strong>200K</strong>
              <span>rows in shared dataset</span>
            </div>
            <div>
              <strong>{ROW_HEIGHT}px</strong>
              <span>fixed row height</span>
            </div>
            <div>
              <strong>6</strong>
              <span>columns rendered</span>
            </div>
          </div>
        </div>
      </header>
      <section class="controls" aria-label="Benchmark controls">
        <div class="control-copy">
          <span class="live-dot" />
          All three tables are live{' '}
          <span class="control-muted">· scroll any panel to inspect</span>
        </div>
        <label class="sync-toggle">
          <input
            type="checkbox"
            checked={syncScroll}
            disabled={running}
            onChange={(event) => {
              syncEnabled.current = event.currentTarget.checked
              setSyncScroll(syncEnabled.current)
            }}
          />
          <span class="toggle-ui" />
          Sync scroll
        </label>
        <button
          type="button"
          class="benchmark-button"
          onClick={runBenchmark}
          disabled={running}
        >
          {running ? 'Running scroll pass…' : 'Run scroll benchmark'}
          <span>↗</span>
        </button>
      </section>
      <section
        inert={running}
        class="engine-grid"
        aria-label="Virtualization implementations"
      >
        {engines.map((engine) => (
          <EngineCard
            key={engine.id}
            engine={engine}
            data={data}
            onScroll={handleScroll}
            register={registrations[engine.id]}
            renderedRows={renderedRows[engine.id]}
            result={results[engine.id]}
          />
        ))}
      </section>
      <section class="benchmark-strip" data-results={JSON.stringify(results)}>
        <div>
          <span class="strip-label">BENCHMARK</span>
          <strong>
            {running
              ? 'Sampling scroll latency…'
              : error ||
                (Object.keys(results).length
                  ? 'Latest scroll pass'
                  : 'No run yet')}
          </strong>
        </div>
        <div class="benchmark-legend">
          <span>
            <i class="legend-line" />
            Main-thread work per scroll frame
          </span>
          <span>54 jumps / engine · warmed · rotating order</span>
        </div>
        {Object.keys(results).length > 0 && (
          <div class="result-summary">
            {engines.map(
              (engine) =>
                results[engine.id] && (
                  <span key={engine.id}>
                    <b style={{ color: engine.color }}>
                      {engine.name.split('/')[0]}
                    </b>{' '}
                    {results[engine.id]!.average.toFixed(2)}ms{' '}
                    <small>
                      p95 {results[engine.id]!.p95.toFixed(2)} · js{' '}
                      {results[engine.id]!.script.toFixed(2)}
                    </small>
                  </span>
                ),
            )}
          </div>
        )}
      </section>
      <footer>
        <span>Virtuality benchmark</span>
        <span>Fixed-size rows · no pagination · browser runtime only</span>
      </footer>
    </main>
  )
}
