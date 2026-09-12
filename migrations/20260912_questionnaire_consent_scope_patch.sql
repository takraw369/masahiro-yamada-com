-- Existing databases may already have answer_sessions from an earlier incremental migration.
alter table public.answer_sessions drop constraint if exists answer_sessions_consent_scope_check;
alter table public.answer_sessions add constraint answer_sessions_consent_scope_check
  check (consent_scope in ('private','anonymous_aggregate','research','coaching','marketing_followup'));
