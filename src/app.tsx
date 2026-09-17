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
import { experimental_VGrid as VGrid } from 'virtua'
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
type EngineController = {
  scrollTo: (offset: number) => void
  getMaxScroll: () => number
  getRenderedRows: () => number
}
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
    detail: 'Готовый VGrid с измерением viewport',
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
    register({
      scrollTo: (offset) => {
        if (rootRef.current) rootRef.current.scrollTop = offset
      },
      getMaxScroll: () =>
        rootRef.current
          ? rootRef.current.scrollHeight - rootRef.current.clientHeight
          : 0,
      getRenderedRows: () =>
        rootRef.current?.querySelectorAll('[data-row]').length ?? 0,
    })
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
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const reportScroll = useCallback(
    (offset: number) => {
      onScroll('virtua', offset)
    },
    [onScroll],
  )
  useLayoutEffect(() => {
    register({
      scrollTo: (offset) => {
        if (viewportRef.current) viewportRef.current.scrollTop = offset
      },
      getMaxScroll: () =>
        viewportRef.current
          ? viewportRef.current.scrollHeight - viewportRef.current.clientHeight
          : 0,
      getRenderedRows: () =>
        rootRef.current?.querySelectorAll('[data-row]').length ?? 0,
    })
  }, [register])
  const renderRow = useCallback(
    ({ rowIndex }: { rowIndex: number }) => (
      <div class="table-row" data-row role="row">
        <TableCells row={data[rowIndex]} index={rowIndex} />
      </div>
    ),
    [data],
  )
  return (
    <div ref={rootRef} class="virtua-host" role="rowgroup">
      <VGrid
        domRef={viewportRef}
        data-engine="virtua"
        className="table-scroll"
        style={{ height: VIEWPORT_HEIGHT, overflow: 'auto' }}
        row={data.length}
        col={1}
        cellHeight={ROW_HEIGHT}
        cellWidth={720}
        bufferSize={ROW_HEIGHT * OVERSCAN}
        onScroll={reportScroll}
      >
        {renderRow}
      </VGrid>
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
    register({
      scrollTo: (offset) => {
        const element = getRoot()
        if (element) element.scrollTop = offset
      },
      getMaxScroll: () => {
        const element = getRoot()
        return element ? element.scrollHeight - element.clientHeight : 0
      },
      getRenderedRows: () =>
        getRoot()?.querySelectorAll('[data-row]').length ?? 0,
    })
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
    <div class="table-row" data-row role="row" style={style}>
      <TableCells row={data[index]} index={index} />
    </div>
  )
}

function RowCount({ count }: { count: Signal<number> }) {
  return <>{String(count.value).padStart(2, '0')}</>
}

type BenchmarkResult = { average: number; p95: number }

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
          <strong>{result.average.toFixed(2)} ms avg</strong>
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

export function App() {
  const data = useMemo(createRows, [])
  const controllers = useRef<Partial<Record<EngineId, EngineController>>>({})
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
      for (const { id } of engines)
        renderedRows[id].value = controllers.current[id]?.getRenderedRows() ?? 0
    }, 250)
    return () => window.clearInterval(timer)
  }, [renderedRows, running])
  const handleScroll = useCallback<ScrollHandler>((id, offset) => {
    if (benchmarking.current || !syncEnabled.current || syncing.current) return
    syncing.current = true
    engines.forEach(({ id: targetId }) => {
      if (targetId !== id) controllers.current[targetId]?.scrollTo(offset)
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
    const samples: Record<EngineId, number[]> = {
      tanstack: [],
      virtua: [],
      'react-window': [],
    }
    try {
      // Finish UI commits, pending sync events and scroll-end timers before warming up.
      await settle()
      const maxScroll = Math.min(
        ...engines.map(({ id }) => {
          const controller = controllers.current[id]
          if (!controller) throw new Error(`Engine not ready: ${id}`)
          return controller.getMaxScroll()
        }),
      )
      if (maxScroll <= 0) throw new Error('Scrollable viewport is not ready.')
      const positions = Array.from({ length: 18 }, (_, index) =>
        Math.round((maxScroll * (index + 1)) / 18),
      )
      for (const { id } of engines) {
        const controller = controllers.current[id]!
        for (const position of [0, maxScroll / 2, maxScroll, 0]) {
          controller.scrollTo(position)
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
          const controller = controllers.current[id]!
          controller.scrollTo(0)
          await settle()
          for (const position of positions) {
            await nextFrame()
            check()
            const start = performance.now()
            controller.scrollTo(position)
            // Two frame boundaries allow the scroll event and its resulting commit to run.
            await nextFrame()
            await nextFrame()
            const elapsed = performance.now() - start
            check()
            samples[id].push(elapsed)
          }
          await settle()
        }
      }
      const nextResults: Partial<Record<EngineId, BenchmarkResult>> = {}
      for (const { id } of engines) {
        const values = samples[id]
        const sorted = [...values].sort((a, b) => a - b)
        nextResults[id] = {
          average:
            values.reduce((sum, value) => sum + value, 0) / values.length,
          p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        }
      }
      setResults(nextResults)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      engines.forEach(({ id }) => controllers.current[id]?.scrollTo(0))
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
      <section class="benchmark-strip">
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
            Two-frame scroll latency
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
                    {results[engine.id]!.average.toFixed(1)}ms{' '}
                    <small>p95 {results[engine.id]!.p95.toFixed(1)}</small>
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
