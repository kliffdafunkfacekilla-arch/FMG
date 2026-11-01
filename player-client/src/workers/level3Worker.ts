import { generateLevel3Map } from '../utils/Level3Generator';

export interface Level3WorkerRequest {
  id: string;
  manifest: any;
}

export interface Level3WorkerResponse {
  id: string;
  gridBuffer: ArrayBuffer;
  size: number;
}

self.onmessage = (e: MessageEvent<Level3WorkerRequest>) => {
  const { id, manifest } = e.data;
  try {
    const result = generateLevel3Map(manifest);
    // Transfer the underlying ArrayBuffer zero-copy
    const buffer = result.grid.buffer;
    (self as unknown as Worker).postMessage(
      {
        id,
        gridBuffer: buffer,
        size: result.size
      },
      [buffer]
    );
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      id,
      error: err?.message || 'Worker generation failed'
    });
  }
};

