/** Minimal id-keyed registry used by objects, adjectives, behaviors and levels. */
export class Registry<T extends { id: string }> {
  private items = new Map<string, T>();

  constructor(readonly kind: string) {}

  register(item: T): T {
    if (this.items.has(item.id)) console.warn(`[blockspell] duplicate ${this.kind} id "${item.id}", overriding`);
    this.items.set(item.id, item);
    return item;
  }

  /** Registers every default export of an `import.meta.glob(..., { eager: true })` result. */
  registerModules(modules: Record<string, { default: T | T[] }>): void {
    for (const path of Object.keys(modules).sort()) {
      const exp = modules[path].default;
      if (!exp) {
        console.warn(`[blockspell] ${path} has no default export`);
        continue;
      }
      for (const item of Array.isArray(exp) ? exp : [exp]) this.register(item);
    }
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  all(): T[] {
    return [...this.items.values()];
  }
}
