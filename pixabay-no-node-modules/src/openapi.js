/** OpenAPI 3.0 document for Swagger UI */
module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Pixabay asset bridge',
    version: '1.0.0',
    description:
      'REST facade for Pixabay vectors, videos, music, and sound effects. ' +
      'Search and discovery use a local [Lightpanda](https://lightpanda.io) CDP server with Puppeteer to load pixabay.com. ' +
      'Pixabay is protected by Cloudflare; if listings are empty, export cookies from a logged-in browser session into `PIXABAY_COOKIE`.',
  },
  servers: [
    { url: 'http://127.0.0.1:3000', description: 'Local dev (Swagger Try it out)' },
    { url: '/', description: 'Same origin as this UI' },
  ],
  tags: [
    { name: 'Discovery' },
    { name: 'Health' },
    { name: 'Vectors' },
    { name: 'Videos' },
    { name: 'Music' },
    { name: 'Sound effects' },
  ],
  components: {
    schemas: {
      ClientError: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: { type: 'string', enum: ['invalid_category', 'invalid_id'] },
          message: { type: 'string' },
          received: { type: 'string' },
          allowed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only set when error is invalid_category',
          },
        },
      },
    },
  },
  paths: {
    '/api': {
      get: {
        tags: ['Discovery'],
        summary: 'API root',
        description:
          'JSON discovery document with links to health, OpenAPI spec, Swagger UI, and v1 routes. ' +
          'Replaces a redirect so clients and scripts get a 200 without following Location.',
        responses: {
          '200': {
            description: 'Metadata and relative URLs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'version', 'links'],
                  properties: {
                    title: { type: 'string' },
                    version: { type: 'string' },
                    description: { type: 'string' },
                    links: {
                      type: 'object',
                      properties: {
                        self: { type: 'string' },
                        health: { type: 'string' },
                        documentation: { type: 'string' },
                        openapi: { type: 'string' },
                        v1: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/v1/vectors/search': {
      get: {
        tags: ['Vectors'],
        summary: 'Search vectors',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', default: ' ' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        ],
        responses: { '200': { description: 'Search results' }, '502': { description: 'Browser automation failed' } },
      },
    },
    '/api/v1/videos/search': {
      get: {
        tags: ['Videos'],
        summary: 'Search videos',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', default: ' ' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        ],
        responses: { '200': { description: 'Search results' }, '502': { description: 'Browser automation failed' } },
      },
    },
    '/api/v1/music/search': {
      get: {
        tags: ['Music'],
        summary: 'Search music',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', default: ' ' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        ],
        responses: { '200': { description: 'Search results' }, '502': { description: 'Browser automation failed' } },
      },
    },
    '/api/v1/sound-effects/search': {
      get: {
        tags: ['Sound effects'],
        summary: 'Search sound effects',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', default: ' ' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        ],
        responses: { '200': { description: 'Search results' }, '502': { description: 'Browser automation failed' } },
      },
    },
    '/api/v1/{category}/assets/{id}/download-info': {
      get: {
        summary: 'List candidate download URLs for an asset id',
        parameters: [
          {
            name: 'category',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['vectors', 'videos', 'music', 'sound-effects'] },
          },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Candidate URLs' },
          '400': {
            description: 'Unknown category or id without digits',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientError' } } },
          },
          '502': { description: 'Browser automation failed' },
        },
      },
    },
    '/api/v1/{category}/assets/{id}/file': {
      get: {
        summary: 'Download binary (first resolvable candidate)',
        parameters: [
          {
            name: 'category',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['vectors', 'videos', 'music', 'sound-effects'] },
          },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'url',
            in: 'query',
            description: 'Optional explicit CDN URL (skips browser resolution)',
            schema: { type: 'string', format: 'uri' },
          },
        ],
        responses: {
          '200': { description: 'File bytes' },
          '400': {
            description: 'Unknown category or id without digits',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientError' } } },
          },
          '404': { description: 'No download URL resolved' },
          '502': { description: 'Fetch failed' },
        },
      },
    },
  },
};
