import { startPreview } from './local-preview.mjs';
const child = await startPreview();
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
