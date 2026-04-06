import { defineConfig } from 'vite'
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',       // safe: inside mok-src/dist/ (not a parent dir)
    emptyOutDir: true,
    rollupOptions: {
      input: { mok: './index.html' },
      output: {
        entryFileNames: 'mok-assets/[name]-[hash].js',
        chunkFileNames: 'mok-assets/[name]-[hash].js',
        assetFileNames: 'mok-assets/[name]-[hash][extname]',
      }
    }
  },
  plugins: [
    {
      // After build: copy built files up to repo root
      name: 'copy-to-root',
      closeBundle() {
        const repoRoot = resolve(__dirname, '..')
        const dist     = resolve(__dirname, 'dist')

        // mok.html → repo root
        copyFileSync(`${dist}/mok.html`, `${repoRoot}/mok.html`)
        console.log('✓ mok.html → repo root')

        // mok-assets/ → repo root
        const assetsOut = `${repoRoot}/mok-assets`
        if (existsSync(assetsOut)) cpSync(assetsOut, assetsOut, { recursive: true })
        cpSync(`${dist}/mok-assets`, assetsOut, { recursive: true })
        console.log('✓ mok-assets/ → repo root')
      }
    }
  ]
})
