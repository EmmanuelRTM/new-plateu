import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

describe('EventBus', () => {
  it('delivers emitted payloads to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('player:exitedShrine', handler);
    bus.emit('player:exitedShrine', { x: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ x: 1 });
  });

  it('emits undefined payloads without throwing', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.emit('ping');
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('does nothing when emitting an event with no subscribers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nobody', 1)).not.toThrow();
  });

  it('returns an unsubscribe function from on()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsubscribe = bus.on('tick', handler);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    bus.emit('tick', 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() removes a specific handler and leaves others', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('tick', a);
    bus.on('tick', b);
    bus.off('tick', a);
    bus.emit('tick', 2);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(2);
  });

  it('off() on an unknown event or handler is a no-op', () => {
    const bus = new EventBus();
    expect(() => bus.off('missing', () => {})).not.toThrow();
    bus.on('tick', () => {});
    expect(() => bus.off('tick', () => {})).not.toThrow();
  });

  it('keeps events isolated from one another', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('a', handler);
    bus.emit('b', 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handlers in subscription order', () => {
    const bus = new EventBus();
    const order = [];
    bus.on('e', () => order.push('first'));
    bus.on('e', () => order.push('second'));
    bus.emit('e');
    expect(order).toEqual(['first', 'second']);
  });

  it('does not call the same handler twice when subscribed twice', () => {
    // A Set-backed registry: re-adding the same function is idempotent.
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('e', handler);
    bus.on('e', handler);
    bus.emit('e');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('a handler added during emit is not called for that emit', () => {
    const bus = new EventBus();
    const late = vi.fn();
    bus.on('e', () => bus.on('e', late));
    bus.emit('e');
    expect(late).not.toHaveBeenCalled();
    bus.emit('e');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('a handler removed during emit still does not break iteration of the others', () => {
    const bus = new EventBus();
    const second = vi.fn();
    const first = () => bus.off('e', second);
    bus.on('e', first);
    bus.on('e', second);
    expect(() => bus.emit('e')).not.toThrow();
    // second was removed during this emit, but iteration is over a copy so it still runs once.
    expect(second).toHaveBeenCalledTimes(1);
    bus.emit('e');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a handler that unsubscribes itself does not skip the next handler', () => {
    const bus = new EventBus();
    const after = vi.fn();
    let unsubscribeSelf;
    unsubscribeSelf = bus.on('e', () => unsubscribeSelf());
    bus.on('e', after);
    bus.emit('e');
    expect(after).toHaveBeenCalledTimes(1);
  });
});
