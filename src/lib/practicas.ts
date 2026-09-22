import { getCollection } from 'astro:content';

export async function publishedPracticas() {
  const entries = await getCollection('practicas', ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
}
