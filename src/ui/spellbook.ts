import type { AdjectiveDef } from '../adjectives/types';
import type { ObjectCategory, ObjectDef } from '../objects/types';
import { h } from './dom';

const STORAGE_KEY = 'blockspell.spellbook.v1';

const SECTIONS: { id: ObjectCategory; title: string; icon: string }[] = [
  { id: 'animals', title: 'Creatures', icon: '🐾' },
  { id: 'vehicles', title: 'Vehicles & flyers', icon: '🚀' },
  { id: 'structures', title: 'Building & gadgets', icon: '🧱' },
  { id: 'nature', title: 'Nature & elements', icon: '🌿' },
  { id: 'food', title: 'Food', icon: '🧀' },
  { id: 'items', title: 'Everyday things', icon: '🔑' },
];

/**
 * Tracks which nouns and adjectives the player has discovered (saved in
 * localStorage, so it survives reloads — still fully offline) and renders the
 * spellbook side panel.
 */
export class Spellbook {
  readonly el = h('aside.spellbook.hidden', { 'aria-label': 'Spellbook' });
  private objects = new Set<string>();
  private adjectives = new Set<string>();

  constructor(
    private allObjects: ObjectDef[],
    private allAdjectives: AdjectiveDef[],
    private onCast: (word: string) => void,
  ) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { objects?: string[]; adjectives?: string[] };
      saved.objects?.forEach((id) => this.objects.add(id));
      saved.adjectives?.forEach((id) => this.adjectives.add(id));
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
  }

  /** Discovered words that are in the book (ignores stale saved ids). */
  get count(): number {
    return this.allObjects.filter((d) => this.objects.has(d.id)).length;
  }

  /** Total words in the book. */
  get total(): number {
    return this.allObjects.length;
  }

  has(id: string): boolean {
    return this.objects.has(id);
  }

  /** Records a cast; returns what was new so the game can celebrate. */
  discover(objectId: string, adjectiveIds: string[]): { object: boolean; adjectives: string[] } {
    const object = !this.objects.has(objectId) && this.allObjects.some((d) => d.id === objectId);
    if (object) this.objects.add(objectId);
    const fresh = [...new Set(adjectiveIds)].filter((a) => !this.adjectives.has(a));
    fresh.forEach((a) => this.adjectives.add(a));
    if (object || fresh.length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ objects: [...this.objects], adjectives: [...this.adjectives] }));
      } catch {
        /* ignore quota / privacy mode */
      }
      if (this.isOpen) this.render();
    }
    return { object, adjectives: fresh };
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  toggle(open = !this.isOpen): void {
    if (open) this.render();
    this.el.classList.toggle('hidden', !open);
  }

  private render(): void {
    const total = this.total;
    const count = this.count;
    const sections = SECTIONS.map((s) => {
      const defs = this.allObjects.filter((d) => (d.category ?? 'items') === s.id).sort((a, b) => a.name.localeCompare(b.name));
      if (!defs.length) return null;
      const found = defs.filter((d) => this.objects.has(d.id));
      const chips = defs.map((d) =>
        this.objects.has(d.id)
          ? h('button.sb-word', {
              type: 'button',
              text: d.name,
              title: [d.blurb, d.synonyms?.length ? `Also: ${d.synonyms.slice(0, 5).join(', ')}` : ''].filter(Boolean).join('\n'),
              onClick: () => this.onCast(d.name),
            })
          : h('span.sb-word.unknown', { text: '?', title: 'Not discovered yet' }),
      );
      return h('section.sb-section', {}, [
        h('h3', {}, [h('span', { text: `${s.icon} ${s.title}` }), h('span.sb-count', { text: `${found.length}/${defs.length}` })]),
        h('div.sb-words', {}, chips),
      ]);
    });
    const adjs = this.allAdjectives.slice().sort((a, b) => a.id.localeCompare(b.id));
    const adjFound = adjs.filter((a) => this.adjectives.has(a.id));
    this.el.replaceChildren(
      h('header.sb-header', {}, [
        h('div', {}, [h('h2', { text: 'Spellbook' }), h('div.sb-total', { text: `${count} of ${total} words discovered` })]),
        h('button.icon-btn', { title: 'Close (Esc)', text: '✕', onClick: () => this.toggle(false) }),
      ]),
      h('div.sb-progress', {}, [h('div.sb-bar', { style: `width:${(100 * count) / Math.max(1, total)}%` })]),
      h('div.sb-body', {}, [
        ...sections,
        h('section.sb-section', {}, [
          h('h3', {}, [h('span', { text: '✨ Adjectives' }), h('span.sb-count', { text: `${adjFound.length}/${adjs.length}` })]),
          h('div.sb-words', {}, adjs.map((a) =>
            this.adjectives.has(a.id)
              ? h('span.sb-word.adj', { text: a.id, title: a.synonyms?.length ? `Also: ${a.synonyms.slice(0, 5).join(', ')}` : '' })
              : h('span.sb-word.unknown', { text: '?', title: 'Not discovered yet' }),
          )),
        ]),
        h('p.sb-tip', { text: 'Tip: stack adjectives — “giant flaming dog”, “tiny golden rocket”, “angry ghostly cow”.' }),
      ]),
    );
  }
}
