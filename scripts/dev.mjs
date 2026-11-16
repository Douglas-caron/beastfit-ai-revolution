import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', shell: false }),
  spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '0.0.0.0'], { stdio: 'inherit', shell: false })
];

function shutdown() {
  for (const child of processes) child.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) shutdown();
  });
}
