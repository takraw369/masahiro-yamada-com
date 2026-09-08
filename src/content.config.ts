import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const tips = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/tips' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    category: z.enum(['比較三原則', '第0層', 'be-do-have', 'FLOW', 'フジサン', 'その他']),
    publish: z.boolean().optional(),
    publish_to: z.string().optional(),
    access: z.literal('public'),
    related_lp: z.string().optional(),
  }),
});

export const collections = { tips };
