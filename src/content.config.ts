import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const practicas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/practicas' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { practicas };
