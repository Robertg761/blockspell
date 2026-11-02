/** Tiny DOM helper: h('div.cls#id', { attrs }, children). */
export function h<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}` | `${K}#${string}`,
  attrs: Record<string, unknown> = {},
  children: (Node | string | null | undefined | false)[] = [],
): HTMLElementTagNameMap[K] {
  const [tagAndClasses, id] = spec.split('#');
  const [tag, ...classes] = tagAndClasses.split('.');
  const el = document.createElement(tag as K);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
