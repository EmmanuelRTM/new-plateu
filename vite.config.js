import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 600, // three.js alone is ~550 kB; it is split into its own cached chunk
    // Rolldown (Vite 8) takes the function form; keep three.js in its own cached chunk.
    rollupOptions: { output: { manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined) } },
  },
});
