import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiMiddlewarePlugin(): Plugin {
  return {
    name: 'api-serverless-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        const query = Object.fromEntries(url.searchParams.entries());

        let body: any = {};
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(chunk as Buffer);
          }
          const raw = Buffer.concat(buffers).toString('utf-8');
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { raw };
          }
        }

        const resHelper: any = res;
        resHelper.status = (code: number) => {
          res.statusCode = code;
          return resHelper;
        };
        resHelper.json = (data: any) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return resHelper;
        };
        resHelper.send = (data: any) => {
          res.end(data);
          return resHelper;
        };

        const reqHelper: any = req;
        reqHelper.query = query;
        reqHelper.body = body;

        try {
          if (url.pathname === '/api/webhook/whatsapp') {
            const mod = await server.ssrLoadModule('/api/webhook/whatsapp.ts');
            return await mod.default(reqHelper, resHelper);
          }
          if (url.pathname === '/api/webhook/instagram') {
            const mod = await server.ssrLoadModule('/api/webhook/instagram.ts');
            return await mod.default(reqHelper, resHelper);
          }
          if (url.pathname === '/api/webhook/sitechat') {
            const mod = await server.ssrLoadModule('/api/webhook/sitechat.ts');
            return await mod.default(reqHelper, resHelper);
          }
          if (url.pathname === '/api/webhook/agent-send') {
            const mod = await server.ssrLoadModule('/api/webhook/agent-send.ts');
            return await mod.default(reqHelper, resHelper);
          }
          if (url.pathname === '/api/health') {
            const mod = await server.ssrLoadModule('/api/health.ts');
            return await mod.default(reqHelper, resHelper);
          }
        } catch (err: any) {
          console.error('API middleware error:', err);
          return resHelper.status(500).json({ error: err?.message || 'Serverless error' });
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiMiddlewarePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
