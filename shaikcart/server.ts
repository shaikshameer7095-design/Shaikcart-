import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import publicRoutes from './src/server/routes/public.ts';
import authRoutes from './src/server/routes/auth.ts';
import customerRoutes from './src/server/routes/customer.ts';
import adminRoutes from './src/server/routes/admin.ts';
import { db } from './src/db/index.ts';
import { categories, products } from './src/db/schema.ts';
import { ensureDatabaseSeeded } from './src/db/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Capture raw body specifically for Razorpay webhook HMAC verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req: any, _res, buf) => {
        if (req.originalUrl && req.originalUrl.startsWith('/api/payments/razorpay/webhook')) {
          req.rawBody = buf;
        }
      },
    })
  );

  // Dynamic robots.txt
  app.get('/robots.txt', (_req, res) => {
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    res.type('text/plain');
    res.send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /checkout',
        'Disallow: /account',
        appUrl ? `Sitemap: ${appUrl}/sitemap.xml` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  });

  // Dynamic sitemap.xml from PostgreSQL catalog
  app.get('/sitemap.xml', async (req, res) => {
    try {
      await ensureDatabaseSeeded();
      const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const [allCats, allProds] = await Promise.all([
        db.select({ slug: categories.slug }).from(categories).where(eq(categories.isActive, true)),
        db
          .select({ slug: products.slug, updatedAt: products.updatedAt })
          .from(products)
          .where(eq(products.isActive, true)),
      ]);

      const staticPaths = [
        '/',
        '/shop',
        '/search',
        '/track-order',
        '/about',
        '/contact',
        '/faq',
        '/shipping-policy',
        '/return-policy',
        '/privacy-policy',
        '/terms',
      ];

      const urls = [
        ...staticPaths.map((p) => `<url><loc>${origin}${p}</loc></url>`),
        ...allCats.map((c) => `<url><loc>${origin}/category/${c.slug}</loc></url>`),
        ...allProds.map(
          (p) =>
            `<url><loc>${origin}/product/${p.slug}</loc><lastmod>${new Date(p.updatedAt).toISOString().slice(0, 10)}</lastmod></url>`
        ),
      ];

      res.type('application/xml');
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
      );
    } catch (error) {
      console.error('Sitemap generation error:', error);
      res.status(500).send('Unable to generate sitemap');
    }
  });

  // Mount API routers
  app.use('/api', publicRoutes);
  app.use('/api', authRoutes);
  app.use('/api', customerRoutes);
  app.use('/api/admin', adminRoutes);

  // API 404 fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build artifacts not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHAIKCART server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
