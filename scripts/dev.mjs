import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', 'server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'inherit' }),
];
let closing = false;
function close(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill(); setTimeout(() => process.exit(code), 500).unref(); }
for (const child of children) { child.on('exit', code => close(code ?? 0)); child.on('error', () => close(1)); }
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
