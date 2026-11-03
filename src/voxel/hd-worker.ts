import { meshHD, type HDJob } from './hd-core';

/** HD meshing off the main thread: one job in, packed arrays out (transferred, not copied). */
self.onmessage = (ev: MessageEvent<{ id: number; job: HDJob }>) => {
  const { id, job } = ev.data;
  try {
    const r = meshHD(job);
    (self as unknown as Worker).postMessage({ id, r }, [r.position.buffer, r.normal.buffer, r.color.buffer, r.index.buffer]);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, error: String((e as Error)?.stack ?? e) });
  }
};
