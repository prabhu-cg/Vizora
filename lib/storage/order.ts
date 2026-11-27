/**
 * The custom order of visualisations inside a project. Records written before
 * ordering existed have no `order`; they sort first, oldest first, so nothing
 * moves unexpectedly and anything added later lands after them.
 */
export interface Orderable {
  order?: number;
  createdAt: string;
}

export function compareByCustomOrder(a: Orderable, b: Orderable): number {
  const x = a.order ?? Number.NEGATIVE_INFINITY;
  const y = b.order ?? Number.NEGATIVE_INFINITY;
  if (x !== y) return x < y ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/** The order value that places a new item after everything already in a project. */
export function nextOrder(items: readonly Pick<Orderable, "order">[]): number {
  return items.reduce((max, i) => (i.order !== undefined && i.order > max ? i.order : max), -1) + 1;
}
