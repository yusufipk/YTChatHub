import { startBackend } from './index.js';

void startBackend().catch((error) => {
  console.error('Failed to start backend', error);
  process.exitCode = 1;
});
