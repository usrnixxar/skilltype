import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore
import { handleApiRequest } from './server/api.js';

function leaderboardApiPlugin(): Plugin {
  return {
    name: 'skilltype-leaderboard-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handleApiRequest(req, res);
          if (!handled) {
            next();
          }
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), leaderboardApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
