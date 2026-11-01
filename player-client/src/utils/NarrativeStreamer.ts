/**
 * NARRATIVE PROSE STREAMER & OPTIMISTIC TURN RESOLVER
 * ====================================================
 * Connects the tactical client to Concordia GM with zero-latency mechanical feedback:
 * 1. Immediate resolution of opposed rolls, damage numbers, and DB state.
 * 2. Asynchronous streaming of sensory Gemini GM narrative text.
 * 3. Typewriter smooth cadencing with terminal cursor rendering.
 */

export interface MechanicsPayload {
  success: boolean;
  systemLog?: string;
  lootAwarded?: any;
  objectiveProgress?: any;
  campaignState?: any;
  dialogue?: string;
  intent?: any;
}

/**
 * Streams a full string of text token-by-token or word-by-word into a callback.
 */
export function streamTypewriter(
  fullText: string,
  onUpdate: (currentText: string, isDone: boolean) => void,
  charsPerStep = 4,
  intervalMs = 18
): () => void {
  let index = 0;
  const timer = setInterval(() => {
    index += charsPerStep;
    if (index >= fullText.length) {
      clearInterval(timer);
      onUpdate(fullText, true);
    } else {
      onUpdate(fullText.slice(0, index), false);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

/**
 * Optimistically executes a turn via Server-Sent Events (SSE) or fallback JSON.
 */
export async function streamConcordiaAction(
  url: string,
  body: any,
  callbacks: {
    onMechanics: (data: MechanicsPayload) => void;
    onChunk: (delta: string) => void;
    onDone: () => void;
    onError: (err: string) => void;
  }
): Promise<void> {
  try {
    const streamUrl = url.includes('/action') ? url.replace('/action', '/action_stream') : url;
    const response = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/event:\s*([a-zA-Z0-9_-]+)/);
        const dataMatch = block.match(/data:\s*(.*)/s);

        const event = eventMatch ? eventMatch[1] : 'message';
        const dataStr = dataMatch ? dataMatch[1] : '';

        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (event === 'mechanics') {
            callbacks.onMechanics(parsed);
          } else if (event === 'chunk') {
            callbacks.onChunk(parsed.text || '');
          } else if (event === 'done') {
            callbacks.onDone();
          } else if (event === 'error') {
            callbacks.onError(parsed.error || 'Unknown error');
          }
        } catch {
          // Plain text fallback
          if (event === 'chunk') callbacks.onChunk(dataStr);
        }
      }
    }

    callbacks.onDone();
  } catch (err: any) {
    // If streaming endpoint failed, fallback cleanly to standard POST /action
    try {
      const fallbackRes = await fetch(url.replace('/action_stream', '/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await fallbackRes.json();
      if (data.error) throw new Error(data.error);

      callbacks.onMechanics({
        success: data.success,
        systemLog: data.systemLog,
        lootAwarded: data.lootAwarded,
        objectiveProgress: data.objectiveProgress,
        campaignState: data.campaignState,
        dialogue: data.dialogue,
        intent: data.intent
      });

      if (data.narrativeResponse) {
        let lastLen = 0;
        streamTypewriter(data.narrativeResponse, (text, isDone) => {
          const delta = text.slice(lastLen);
          lastLen = text.length;
          callbacks.onChunk(delta);
          if (isDone) callbacks.onDone();
        });
      } else {
        callbacks.onDone();
      }
    } catch (fallbackErr: any) {
      callbacks.onError(fallbackErr.message || 'Action failed');
    }
  }
}
