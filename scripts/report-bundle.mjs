import { readFile, readdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const html = await readFile('dist/bundle-stats.html', 'utf8')
const match = html.match(/const data = (\{"version"[^\n]+);/)
if (!match) throw new Error('Visualizer data not found')
const report = JSON.parse(match[1])
if (!report.options.gzip || report.options.sourcemap) {
  throw new Error(
    'Chunk report must have gzip enabled and sourcemap attribution disabled',
  )
}
const definitions = [
  [
    '@tanstack/react-virtual + @tanstack/virtual-core',
    'tanstack-virtual',
    ['@tanstack/react-virtual', '@tanstack/virtual-core'],
  ],
  ['virtua (Virtualizer)', 'virtua', ['virtua']],
  ['react-window (List)', 'react-window', ['react-window']],
  ['Shared Preact runtime', 'preact-runtime', ['preact']],
  ['Shared signals', 'signals', ['@preact/signals', '@preact/signals-core']],
]
const files = await readdir('dist/assets')
const rows = []
for (const [library, prefix, packages] of definitions) {
  const matches = files.filter(
    (file) => file.startsWith(`${prefix}-`) && file.endsWith('.js'),
  )
  if (matches.length !== 1)
    throw new Error(`Expected one ${prefix} chunk, found ${matches.length}`)
  const file = `assets/${matches[0]}`
  const code = await readFile(`dist/${file}`)
  const minified = code.byteLength
  const gzip = gzipSync(code, { level: 9 }).byteLength
  const meta = Object.values(report.nodeMetas).find(
    (entry) => entry.moduleParts[file],
  )
  const sizes = meta && report.nodeParts[meta.moduleParts[file]]
  if (sizes?.renderedLength !== minified || sizes?.gzipLength !== gzip) {
    throw new Error(`Visualizer/file size mismatch: ${file}`)
  }
  const versions = {}
  for (const name of packages) {
    versions[name] = JSON.parse(
      await readFile(`node_modules/${name}/package.json`, 'utf8'),
    ).version
  }
  rows.push({
    library,
    versions,
    file,
    minifiedBytes: minified,
    gzipBytes: gzip,
  })
}
await writeFile(
  'docs/bundle-sizes.json',
  `${JSON.stringify({ method: 'Emitted analytical-build chunks; UTF-8 bytes; gzip level 9; shared runtime separated', rows }, null, 2)}\n`,
)
const table = [
  '| Library / shared dependency | Minified bytes | Gzip bytes (level 9) |',
  '| --- | ---: | ---: |',
  ...rows.map(
    (row) =>
      `| ${row.library} | ${row.minifiedBytes.toLocaleString('en-US')} | ${row.gzipBytes.toLocaleString('en-US')} |`,
  ),
].join('\n')
const readme = await readFile('README.md', 'utf8')
const section = /<!-- bundle-sizes:start -->[\s\S]*?<!-- bundle-sizes:end -->/
if (!section.test(readme))
  throw new Error('README bundle table markers missing')
await writeFile(
  'README.md',
  readme.replace(
    section,
    `<!-- bundle-sizes:start -->\n${table}\n<!-- bundle-sizes:end -->`,
  ),
)
console.log(table)
console.log(
  'Verified non-zero visualizer gzip values against emitted chunks; updated README and docs/bundle-sizes.json.',
)
