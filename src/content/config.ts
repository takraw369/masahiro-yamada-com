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

export const collections = { thoughts, curriculum };
