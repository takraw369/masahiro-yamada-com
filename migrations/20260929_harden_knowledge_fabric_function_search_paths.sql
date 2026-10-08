-- Mirrors Supabase migration: harden_knowledge_fabric_function_search_paths
-- Applied to sunlovesflow-core on 2026-09-29.
-- Pin search_path to prevent caller-controlled schema resolution.

alter function public.knowledge_fabric_normalize_node_v1()
  set search_path = '';

alter function public.knowledge_fabric_related_os_parts_v1(text)
  set search_path = '';

alter function public.knowledge_fabric_theme_id_v1(text)
  set search_path = '';
