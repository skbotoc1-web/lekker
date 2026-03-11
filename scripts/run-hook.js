import { migrate } from '../src/core/db.js';
import { runHook } from '../src/hooks/pipelineHooks.js';

const stage = process.argv[2] || 'full';

migrate();
const result = await runHook(stage);
console.log(JSON.stringify(result, null, 2));
