import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    preact(),
    ...(mode === 'analyze'
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            title: 'Minified chunks — rendered / gzip / Brotli',
            template: 'treemap',
            // v7 disables compression in sourcemap mode. Excluding module
            // entries makes visualizer measure complete emitted chunks instead.
            sourcemap: false,
            exclude: [{}],
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
          visualizer({
            filename: 'dist/bundle-modules.html',
            title: 'Module attribution (sourcemap, uncompressed only)',
            sourcemap: true,
            open: false,
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: mode === 'analyze' ? 'hidden' : false,
    // Only the analytical build splits vendors. Runtime benchmarks use build.
    rolldownOptions:
      mode === 'analyze'
        ? {
            output: {
              codeSplitting: {
                groups: [
                  {
                    name: 'preact-runtime',
                    test: /node_modules[\\/]preact[\\/]/,
                    priority: 30,
                  },
                  {
                    name: 'signals',
                    test: /node_modules[\\/]@preact[\\/]/,
                    priority: 20,
                  },
                  {
                    name: 'tanstack-virtual',
                    test: /node_modules[\\/]@tanstack[\\/](react-virtual|virtual-core)[\\/]/,
                    priority: 10,
                  },
                  {
                    name: 'react-window',
                    test: /node_modules[\\/]react-window[\\/]/,
                    priority: 10,
                  },
                  {
                    name: 'virtua',
                    test: /node_modules[\\/]virtua[\\/]/,
                    priority: 10,
                  },
                ],
              },
            },
          }
        : undefined,
  },
}))
