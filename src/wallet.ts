/** Coins the hero has picked up and what they've bought with them. Kept in localStorage, so backups carry it too. */
const KEY = 'blockspell.wallet.v1';

export interface ShopItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  cost: number;
  /** A shirt color: the color adjective's id. Only one can be worn; anything else just works once it's bought. */
  color?: string;
}

export const SHOP: ShopItem[] = [
  { id: 'shirt-red', icon: '🟥', name: 'Red shirt', desc: 'Bright and cheerful.', cost: 5, color: 'red' },
  { id: 'shirt-green', icon: '🟩', name: 'Green shirt', desc: 'Blends in with the meadow.', cost: 5, color: 'green' },
  { id: 'shirt-purple', icon: '🟪', name: 'Purple shirt', desc: 'Very wizardly.', cost: 8, color: 'purple' },
  { id: 'shirt-pink', icon: '🌸', name: 'Pink shirt', desc: 'Can be seen from the sky.', cost: 8, color: 'pink' },
  { id: 'shirt-black', icon: '⬛', name: 'Black shirt', desc: 'Mysterious.', cost: 12, color: 'black' },
  { id: 'boots', icon: '🥾', name: 'Swift boots', desc: 'You run a fifth faster.', cost: 15 },
];

interface Saved {
  coins: number;
  owned: string[];
  shirt: string | null;
}

class Wallet {
  private data: Saved = { coins: 0, owned: [], shirt: null };
  /** Called whenever the coins or what's owned change. */
  onChange: () => void = () => {};

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...(JSON.parse(raw) as Partial<Saved>) };
    } catch {
      /* storage blocked or a broken save: start with an empty purse */
    }
  }

  get coins(): number {
    return this.data.coins;
  }

  /** The id of the shirt being worn. */
  get shirt(): string | null {
    return this.data.shirt;
  }

  owns(id: string): boolean {
    return this.data.owned.includes(id);
  }

  add(n: number): void {
    this.data.coins += n;
    this.changed();
  }

  /** Buys an item, wearing it if it's a shirt. Returns false if the purse is too light. */
  buy(item: ShopItem): boolean {
    if (this.owns(item.id) || this.data.coins < item.cost) return false;
    this.data.coins -= item.cost;
    this.data.owned.push(item.id);
    if (item.color) this.data.shirt = item.id;
    this.changed();
    return true;
  }

  /** Puts on a shirt that's owned, or goes back to the blue one (null). */
  wear(id: string | null): void {
    this.data.shirt = id;
    this.changed();
  }

  private changed(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage blocked: it lasts until the page closes */
    }
    this.onChange();
  }
}

export const wallet = new Wallet();
