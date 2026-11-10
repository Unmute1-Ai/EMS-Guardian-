import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  /**
   * Demo builds only (`VITE_DEMO_MODE=true`, see `npm run build:demo`):
   * inject the PWA manifest link and service-worker registration into
   * index.html. With the flag unset this returns no tags, so production HTML
   * stays byte-identical to today's output.
   */
  const demoPwaHtml = (): HtmlTagDescriptor[] => {
    if (env.VITE_DEMO_MODE !== 'true') return [];
    return [
      {tag: 'link', attrs: {rel: 'manifest', href: '/manifest.webmanifest'}},
      {
        tag: 'script',
        attrs: {type: 'module'},
        children: `\n  if ('serviceWorker' in navigator) {\n    window.addEventListener('load', () => {\n      navigator.serviceWorker.register('/sw.js').catch(() => {});\n    });\n  }\n`,
      },
    ];
  };

  const demoPwaPlugin: Plugin = {
    name: 'demo-pwa-html',
    apply: 'build',
    transformIndexHtml: demoPwaHtml,
  };

  return {
    plugins: [react(), tailwindcss(), demoPwaPlugin],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.NVIDIA_API_KEY': JSON.stringify(env.NVIDIA_API_KEY),
      'process.env.NVIDIA_NIM_MODEL': JSON.stringify(env.NVIDIA_NIM_MODEL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
