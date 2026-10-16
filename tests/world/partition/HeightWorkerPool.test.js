import { describe, it, expect, vi } from 'vitest';
import { createHeightWorkerPool } from '../../../src/world/partition/HeightWorkerPool.js';
import { WORLD } from '../../../src/world/WorldConfig.js';

/** Minimal stand-in for the DOM Worker: records messages and lets the test answer. */
class FakeWorker {
  constructor() {
    this.messages = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(message) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(id, data) {
    this.onmessage({ data: { id, data } });
  }
  fail(message) {
    this.onerror({ message });
  }
}

/** Worker that answers every request on the next microtask with its origin as the sole sample. */
class EchoWorker extends FakeWorker {
  postMessage(message) {
    super.postMessage(message);
    queueMicrotask(() => this.reply(message.id, new Float32Array([message.originX])));
  }
}

const REQUEST = { cx: 0, cz: 0, originX: 0, originZ: 0, size: 256, resolution: 16 };

describe('createHeightWorkerPool', () => {
  it('posts the config and request fields and resolves with the matching reply', async () => {
    const worker = new FakeWorker();
    const pool = createHeightWorkerPool({ config: WORLD, workerFactory: () => worker, size: 1 });
    const promise = pool.request({ ...REQUEST, originX: 256, originZ: -512 });
    expect(worker.messages).toHaveLength(1);
    const msg = worker.messages[0];
    expect(msg.config).toBe(WORLD);
    expect(msg).toMatchObject({ originX: 256, originZ: -512, size: 256, resolution: 16 });
    const data = new Float32Array([1, 2, 3]);
    worker.reply(msg.id, data);
    await expect(promise).resolves.toBe(data);
    expect(pool.pending).toBe(0);
  });

  it('matches replies by id, so out-of-order answers reach the right caller', async () => {
    const worker = new FakeWorker();
    const pool = createHeightWorkerPool({ config: WORLD, workerFactory: () => worker, size: 1 });
    const first = pool.request(REQUEST);
    const second = pool.request({ ...REQUEST, cx: 1 });
    expect(pool.pending).toBe(2);
    worker.reply(worker.messages[1].id, new Float32Array([9]));
    await expect(second).resolves.toEqual(new Float32Array([9]));
    expect(pool.pending).toBe(1);
    worker.reply(worker.messages[0].id, new Float32Array([7]));
    await expect(first).resolves.toEqual(new Float32Array([7]));
    expect(pool.pending).toBe(0);
  });

  it('distributes requests round-robin over the workers', async () => {
    const workers = [];
    const pool = createHeightWorkerPool({
      config: WORLD,
      workerFactory: () => {
        const w = new EchoWorker();
        workers.push(w);
        return w;
      },
      size: 2,
    });
    expect(workers).toHaveLength(2);
    const results = await Promise.all([0, 1, 2, 3].map((i) => pool.request({ ...REQUEST, originX: i })));
    expect(results.map((r) => r[0])).toEqual([0, 1, 2, 3]);
    expect(workers[0].messages).toHaveLength(2);
    expect(workers[1].messages).toHaveLength(2);
  });

  it('rejects the pending request when the worker reports an error event', async () => {
    const worker = new FakeWorker();
    const pool = createHeightWorkerPool({ config: WORLD, workerFactory: () => worker, size: 1 });
    const promise = pool.request(REQUEST);
    worker.fail('boom in heightFn');
    await expect(promise).rejects.toThrow(/boom in heightFn/);
    expect(pool.pending).toBe(0);
  });

  it('rejects a request whose worker replied with an error', async () => {
    const worker = new FakeWorker();
    const pool = createHeightWorkerPool({ config: WORLD, workerFactory: () => worker, size: 1 });
    const promise = pool.request(REQUEST);
    worker.onmessage({ data: { id: worker.messages[0].id, error: 'bad config' } });
    await expect(promise).rejects.toThrow(/bad config/);
  });

  it('dispose terminates every worker and ignores late replies', async () => {
    const workers = [new FakeWorker(), new FakeWorker()];
    let next = 0;
    const pool = createHeightWorkerPool({ config: WORLD, workerFactory: () => workers[next++], size: 2 });
    const settled = vi.fn();
    pool.request(REQUEST).then(settled, settled);
    pool.dispose();
    expect(workers.every((w) => w.terminated)).toBe(true);
    expect(() => workers[0].reply(workers[0].messages[0].id, new Float32Array(1))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(settled).not.toHaveBeenCalled();
    expect(pool.pending).toBe(0);
  });

  it('rejects new requests after dispose', async () => {
    const pool = createHeightWorkerPool({ config: WORLD, workerFactory: () => new FakeWorker(), size: 1 });
    pool.dispose();
    await expect(pool.request(REQUEST)).rejects.toThrow(/disposed/);
  });
});
