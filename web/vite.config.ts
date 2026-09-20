import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served under /ocr-bank-in-slip/ on GitHub Pages (a project site, not a
// user/org root site), but at the server root in dev - only the production
// build needs the subpath prefix. All in-app asset URLs already go through
// import.meta.env.BASE_URL (see src/ocr/tesseractEngine.ts), so this one
// setting is enough for the whole app to resolve correctly either way.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ocr-bank-in-slip/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
}));
