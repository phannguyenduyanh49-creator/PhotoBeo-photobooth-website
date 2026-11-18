import { createService } from './app';
import { configuration } from './config';

const service = createService({ ...configuration(), serveDist: true });
await service.ready;
const server = service.app.listen(Number(process.env.PORT) || 3001, process.env.HOST || '127.0.0.1', () => console.log(`PhotoBeo API: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`));
server.requestTimeout = 60_000;
function close() { server.close(() => { void service.close().then(() => process.exit(0)); }); server.closeIdleConnections(); }
process.on('SIGINT', close); process.on('SIGTERM', close);
