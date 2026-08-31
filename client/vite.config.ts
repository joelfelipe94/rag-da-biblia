import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const raiz = fileURLToPath(new URL('.', import.meta.url));

// Porta do servidor Express (ajuste com API_PORT se você subir o servidor com -p).
const portaApi = process.env.API_PORT ?? '3000';

export default defineConfig({
  root: raiz,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${portaApi}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
