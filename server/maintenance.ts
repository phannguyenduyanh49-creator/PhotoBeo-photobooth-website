import { createService } from './app';
import { configuration } from './config';
const service = createService(configuration());
try {
  await service.ready;
  const result = await service.cleanup(); console.log(JSON.stringify(result));
  if (result.pendingDeletes) process.exitCode = 1;
} finally { await service.close(); }
