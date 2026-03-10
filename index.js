const { runCli } = require('./lib/shimo-exporter');

runCli().catch((error) => {
  console.error('[Fatal]', error.message);
  process.exitCode = 1;
});
