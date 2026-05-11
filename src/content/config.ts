import { defineCollection, z } from 'astro:content';

const thoughts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string()).optional(),
    excerpt: z.string().max(160).optional(),
  }),
});

const curriculum = defineCollection({
  type: 'data',
  schema: z.object({
    week: z.number().min(1).max(12),
    phase: z.enum(['F', 'L', 'O', 'W']),
    title: z.string(),
    cognitive_load: z.number().min(0).max(10),
    physical_load: z.number().min(0).max(10),
    emotional_load: z.number().min(0).max(10),
    key_question: z.string(),
  }),
});

const tips = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    publishedAt: z.coerce.date(),
    category: z.enum(['比較三原則', '第0層', 'be-do-have', 'FLOW', 'フジサン', 'その他']),
    length_short: z.number().optional(),
    length_medium: z.number().optional(),
    related_lp: z.string().optional(),
    hero_image: z.string().optional(),
  }),
});

export const collections = { thoughts, curriculum, tips };
