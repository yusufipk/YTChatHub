import { bootstrapInnertube, fetchChatBatch } from './ingestion/youtubei';

export async function startBackend() {
  console.log('Starting backend worker (youtubei ingestion pending).');
  const state = await bootstrapInnertube();
  console.log('Initial continuation state', state);
  await fetchChatBatch(state);
}

if (require.main === module) {
  void startBackend();
}
