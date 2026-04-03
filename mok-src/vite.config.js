import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: '../',          // builds mok.html into the repo root
    emptyOutDir: false,     // don't wipe index.html etc
    rollupOptions: {
      input: { mok: './index.html' },
      output: {
        entryFileNames: 'mok-assets/[name]-[hash].js',
        chunkFileNames: 'mok-assets/[name]-[hash].js',
        assetFileNames: 'mok-assets/[name]-[hash][extname]',
      }
    }
  }
})
