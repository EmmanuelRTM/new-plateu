// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AbilityChip } from '../../src/ui/AbilityChip.js';

/** Builds a chip inside a detached parent. */
function setup() {
  const parent = document.createElement('div');
  const chip = new AbilityChip(parent);
  return { chip, parent, root: parent.querySelector('.ability-chip') };
}

describe('AbilityChip', () => {
  it('appends an .ability-chip root to the parent', () => {
    const { parent, root } = setup();
    expect(root).not.toBeNull();
    expect(root.parentElement).toBe(parent);
  });

  it('shows the control hints with kbd elements', () => {
    const { root } = setup();
    expect(root.querySelector('.ability-chip-hints').textContent).toBe('Z Next · F Use · X Cancel');
    const keys = [...root.querySelectorAll('kbd')].map((k) => k.textContent);
    expect(keys).toEqual(['Z', 'F', 'X']);
  });

  it('shows the ability name and message on update', () => {
    const { chip, root } = setup();
    chip.update({ ability: 'ultrahand', message: 'Ultrahand: grab (F)' });
    expect(root.querySelector('.ability-chip-name').textContent).toBe('Ultrahand');
    expect(root.querySelector('.ability-chip-message').textContent).toBe('Ultrahand: grab (F)');
  });

  it('updates the name and message when the ability changes', () => {
    const { chip, root } = setup();
    chip.update({ ability: 'ultrahand', message: 'a' });
    chip.update({ ability: 'recall', message: 'Recall: rewind (F)' });
    expect(root.querySelector('.ability-chip-name').textContent).toBe('Recall');
    expect(root.querySelector('.ability-chip-message').textContent).toBe('Recall: rewind (F)');
  });

  it('throws for an unknown ability id', () => {
    const { chip } = setup();
    expect(() => chip.update({ ability: 'autobuild', message: '' })).toThrow(/unknown ability/i);
  });

  it('does not add a second root when updated', () => {
    const { chip, parent } = setup();
    chip.update({ ability: 'fuse', message: 'x' });
    chip.update({ ability: 'fuse', message: 'y' });
    expect(parent.querySelectorAll('.ability-chip')).toHaveLength(1);
  });
});
