import { defineConfig } from 'vite';

// Relative base so the build works on any GitHub Pages path (user site or project site).
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true },
});
