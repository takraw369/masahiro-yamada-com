import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const curriculum = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/curriculum' }),
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
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/tips' }),
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

export const collections = { curriculum, tips };
