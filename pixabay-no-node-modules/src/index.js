const app = require('./app');
const config = require('./config');
const { shutdown } = require('./services/lightpandaBrowser');

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on http://127.0.0.1:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI UI: http://127.0.0.1:${config.port}/api/docs`);
});

async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await shutdown();
}

process.on('SIGINT', () => {
  stop().then(() => process.exit(0)).catch(() => process.exit(1));
});
process.on('SIGTERM', () => {
  stop().then(() => process.exit(0)).catch(() => process.exit(1));
});
