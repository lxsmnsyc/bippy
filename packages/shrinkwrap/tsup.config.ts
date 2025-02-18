import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['inject/index.ts'],
  outDir: 'inject/dist',
  format: 'iife',
  platform: 'browser',
  globalName: 'Shrinkwrap',
  minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
});
