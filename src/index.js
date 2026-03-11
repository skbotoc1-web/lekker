import { migrate } from './core/db.js';
import { config } from './core/config.js';
import { log } from './core/logger.js';
import { scheduleAgents, runFullPipelineOnce } from './agents/orchestrator.js';
import { createServer } from './web/server.js';

migrate();

const app = createServer();
app.listen(config.app.port, () => {
  log.info('server_started', { port: config.app.port, baseUrl: config.app.baseUrl });
});

scheduleAgents();

if (process.env.RUN_PIPELINE_ON_BOOT === 'true') {
  runFullPipelineOnce().catch(err => log.error('pipeline_boot_failed', { error: err.message }));
}
