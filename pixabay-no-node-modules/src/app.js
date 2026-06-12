const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi');
const assetsRouter = require('./routes/assets');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Pixabay asset API' }));
app.get('/api/openapi.json', (_req, res) => res.json(openapi));

app.get(['/api', '/api/'], (_req, res) => {
  const { title, version, description } = openapi.info;
  res.set(
    'Link',
    '</api/docs>; rel="service-doc", </api/openapi.json>; rel="describedby"',
  );
  res.json({
    title,
    version,
    description,
    links: {
      self: '/api',
      health: '/health',
      documentation: '/api/docs',
      openapi: '/api/openapi.json',
      v1: '/api/v1',
    },
  });
});

app.use('/api/v1', assetsRouter);

const publicDir = path.join(__dirname, '..', 'public');

app.get('/', (_req, res, next) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.use(express.static(publicDir));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  const code = err.code === 'ENOENT' ? 404 : 500;
  res.status(code).json({
    error: code === 404 ? 'not_found' : 'server_error',
    message: code === 404 ? 'Missing public/index.html.' : err.message || 'Internal error',
  });
});

app.use((_req, res) => {
  if (!res.headersSent) res.status(404).json({ error: 'not_found' });
});

module.exports = app;
