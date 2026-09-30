import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/** When set by ``run_vite_build`` (CLI HTML report), emit one JS bundle for inlining. */
const inlineHtml = process.env.RESON_INLINE_HTML === '1';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@compare': path.resolve(__dirname, '../compare_report/src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js'),
    },
  },
  build: {
    target: inlineHtml ? 'safari14' : 'esnext',
    outDir: 'build',
    rollupOptions: {
      output: inlineHtml
        ? {
            inlineDynamicImports: true,
          }
        : undefined,
    },
  },
  server: {
    port: 3002,
    open: true,
  },
});
