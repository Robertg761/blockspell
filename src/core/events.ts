import type { Entity } from './entity';

/** Game events. Extend this map when adding new event types. */
export interface GameEvents {
  spawn: { entity: Entity };
  remove: { entity: Entity; reason: string };
  ignite: { entity: Entity };
  extinguish: { entity: Entity };
  burnedUp: { entity: Entity };
  ate: { eater: Entity; food: Entity };
  popped: { entity: Entity };
  tagAdded: { entity: Entity; tag: string };
  tagRemoved: { entity: Entity; tag: string };
  contact: { a: Entity; b: Entity | null; speed: number };
  levelComplete: { levelId: string };
  /** Open world: a task was completed. `first` is its first completion ever, `way` the sorted object ids cast in its zone. */
  taskComplete: { taskId: string; zone: string; first: boolean; way: string[]; newWay: boolean };
  unlocked: { entity: Entity; key: Entity };
  exploded: { at: { x: number; y: number; z: number }; source: Entity | null };
  broken: { entity: Entity };
  /** The hero read a book: show them the hint for what they're doing. */
  hint: Record<string, never>;
  /** The hero picked up a coin they earned. */
  coin: Record<string, never>;
  /** A line for the player, from something they did. */
  say: { text: string };
  /** The player used slow motion or paused time. */
  timeBent: { scale: number };
  /** The player copied or shared a scene link. */
  shared: { url: string };
  /** The player saved a photo. */
  photo: { name: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }
}
