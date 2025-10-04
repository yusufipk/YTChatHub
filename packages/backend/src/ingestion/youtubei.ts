export type ContinuationState = {
  token: string | null;
  apiKey?: string;
};

export async function bootstrapInnertube(): Promise<ContinuationState> {
  // TODO: fetch initial visitor data and live chat continuation token via youtubei.js
  return { token: null };
}

export async function fetchChatBatch(state: ContinuationState) {
  // TODO: use youtubei.js to fetch messages with the provided continuation token
  // return both normalized messages and the next continuation token
  return {
    messages: [],
    next: state.token
  };
}
