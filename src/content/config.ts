import { defineCollection, z } from 'astro:content';

const tips = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    publishedAt: z.coerce.date(),
    category: z.enum(['比較三原則', '第0層', 'be-do-have', 'FLOW', 'フジサン', 'その他']),
    publish: z.boolean().optional(),
    publish_to: z.string().optional(),
    access: z.literal('public'),
    related_lp: z.string().optional(),
  }),
});

export const collections = { tips };
