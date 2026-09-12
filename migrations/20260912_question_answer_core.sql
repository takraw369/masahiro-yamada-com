-- Question / Answer Layer for MASA Human Graph
-- Generic questions are independent from any single form. Answers link to contacts when identity is known.

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  question_text text not null,
  short_label text,
  domain text,
  category text,
  answer_type text not null default 'free_text' check (answer_type in ('single_choice','multi_choice','scale','number','free_text','yes_no','date','ranking')),
  visibility text not null default 'private' check (visibility in ('private','members','public')),
  config jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  source_type text,
  source_ref text,
  status text not null default 'active' check (status in ('draft','active','retired')),
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  option_key text not null,
  label text not null,
  sort_order integer not null default 0,
  numeric_score numeric,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  unique(question_id, option_key)
);

create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  set_key text not null unique,
  name text not null,
  purpose text,
  audience text,
  visibility text not null default 'private' check (visibility in ('private','members','public')),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_set_items (
  set_id uuid not null references public.question_sets(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete restrict,
  sort_order integer not null default 0,
  required boolean not null default false,
  display_logic jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  primary key(set_id, question_id)
);

create table if not exists public.answer_sessions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.contacts(id) on delete set null,
  question_set_id uuid references public.question_sets(id) on delete set null,
  session_key text,
  source_channel text,
  source_ref text,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned','void')),
  consent_scope text not null default 'private' check (consent_scope in ('private','anonymous_aggregate','research','coaching','marketing_followup')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.answer_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.answer_sessions(id) on delete cascade,
  person_id uuid references public.contacts(id) on delete set null,
  question_id uuid not null references public.question_bank(id) on delete restrict,
  response_value jsonb not null default '{}'::jsonb,
  text_value text,
  numeric_value numeric,
  boolean_value boolean,
  source_channel text,
  source_event_id text,
  idempotency_key text unique,
  answered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.answer_selected_options (
  answer_id uuid not null references public.answer_events(id) on delete cascade,
  option_id uuid not null references public.question_options(id) on delete restrict,
  rank_order integer,
  primary key(answer_id, option_id)
);

create index if not exists idx_question_bank_domain on public.question_bank(domain, category, status);
create index if not exists idx_question_bank_tags on public.question_bank using gin(tags);
create index if not exists idx_question_set_items_question on public.question_set_items(question_id, set_id);
create index if not exists idx_answer_sessions_person on public.answer_sessions(person_id, started_at desc);
create index if not exists idx_answer_sessions_question_set on public.answer_sessions(question_set_id);
create unique index if not exists answer_sessions_source_session_key_uidx on public.answer_sessions(source_channel, session_key) where session_key is not null;
create index if not exists idx_answer_events_question on public.answer_events(question_id, answered_at desc);
create index if not exists idx_answer_events_person on public.answer_events(person_id, answered_at desc);
create index if not exists idx_answer_events_session on public.answer_events(session_id);
create index if not exists idx_answer_events_numeric on public.answer_events(question_id, numeric_value) where numeric_value is not null;
create index if not exists idx_answer_events_text_fts on public.answer_events using gin(to_tsvector('simple', coalesce(text_value,'')));
create index if not exists idx_answer_selected_options_option on public.answer_selected_options(option_id, answer_id);

alter table public.question_bank enable row level security;
alter table public.question_options enable row level security;
alter table public.question_sets enable row level security;
alter table public.question_set_items enable row level security;
alter table public.answer_sessions enable row level security;
alter table public.answer_events enable row level security;
alter table public.answer_selected_options enable row level security;
revoke all on table public.question_bank from anon, authenticated;
revoke all on table public.question_options from anon, authenticated;
revoke all on table public.question_sets from anon, authenticated;
revoke all on table public.question_set_items from anon, authenticated;
revoke all on table public.answer_sessions from anon, authenticated;
revoke all on table public.answer_events from anon, authenticated;
revoke all on table public.answer_selected_options from anon, authenticated;

create or replace view public.v_question_answer_stats with (security_invoker = true) as
select q.id as question_id, q.question_key, q.question_text, q.domain, q.category, q.answer_type,
       count(a.id) as answer_count,
       count(distinct a.person_id) filter (where a.person_id is not null) as person_count,
       count(distinct a.session_id) filter (where a.session_id is not null) as session_count,
       avg(a.numeric_value) filter (where a.numeric_value is not null) as numeric_avg,
       min(a.numeric_value) filter (where a.numeric_value is not null) as numeric_min,
       max(a.numeric_value) filter (where a.numeric_value is not null) as numeric_max,
       min(a.answered_at) as first_answered_at,
       max(a.answered_at) as last_answered_at
from public.question_bank q
left join public.answer_events a on a.question_id=q.id
group by q.id, q.question_key, q.question_text, q.domain, q.category, q.answer_type;

create or replace view public.v_question_option_stats with (security_invoker = true) as
select q.id as question_id, q.question_key, q.question_text,
       o.id as option_id, o.option_key, o.label as option_label, o.sort_order,
       count(aso.answer_id) as selection_count,
       count(distinct a.person_id) filter (where a.person_id is not null) as person_count,
       case when totals.total_selections > 0 then round((count(aso.answer_id)::numeric / totals.total_selections::numeric) * 100, 2) else 0 end as selection_pct
from public.question_bank q
join public.question_options o on o.question_id=q.id
left join public.answer_selected_options aso on aso.option_id=o.id
left join public.answer_events a on a.id=aso.answer_id
left join lateral (
  select count(*) as total_selections
  from public.answer_selected_options aso2
  join public.question_options o2 on o2.id=aso2.option_id
  where o2.question_id=q.id
) totals on true
group by q.id,q.question_key,q.question_text,o.id,o.option_key,o.label,o.sort_order,totals.total_selections;

create or replace view public.v_person_answer_history with (security_invoker = true) as
select a.person_id, ps.serial_code, c.display_name, a.id as answer_id, a.session_id,
       q.question_key, q.question_text, q.domain, q.category, q.answer_type,
       a.response_value, a.text_value, a.numeric_value, a.boolean_value, a.answered_at, a.source_channel
from public.answer_events a
join public.question_bank q on q.id=a.question_id
left join public.contacts c on c.id=a.person_id
left join public.person_serials ps on ps.person_id=a.person_id;

create or replace view public.v_question_answer_reverse_lookup with (security_invoker = true) as
select q.question_key,q.question_text,q.domain,q.category,
       a.id as answer_id,a.person_id,ps.serial_code,c.display_name,
       a.response_value,a.text_value,a.numeric_value,a.boolean_value,
       coalesce(array_agg(o.label order by o.sort_order) filter (where o.id is not null), '{}'::text[]) as selected_options,
       a.answered_at,a.source_channel
from public.answer_events a
join public.question_bank q on q.id=a.question_id
left join public.contacts c on c.id=a.person_id
left join public.person_serials ps on ps.person_id=a.person_id
left join public.answer_selected_options aso on aso.answer_id=a.id
left join public.question_options o on o.id=aso.option_id
group by q.question_key,q.question_text,q.domain,q.category,a.id,a.person_id,ps.serial_code,c.display_name,a.response_value,a.text_value,a.numeric_value,a.boolean_value,a.answered_at,a.source_channel;

-- Bring the existing 72 curriculum questions into the reusable question bank.
insert into public.question_bank(question_key,question_text,short_label,domain,category,answer_type,visibility,config,tags,source_type,source_ref,status,version,metadata)
select 'curriculum:' || cq.question_id,
       cq.question_text,
       left(cq.question_text,80),
       coalesce(cq.human_graph_domain,'education'),
       coalesce(cq.theme,cq.lens,'curriculum'),
       case when lower(coalesce(cq.input_modality,'')) like '%scale%' then 'scale'
            when lower(coalesce(cq.input_modality,'')) like '%choice%' then 'single_choice'
            else 'free_text' end,
       'private','{}'::jsonb,
       array_remove(array['curriculum',cq.phase,cq.spine_stage,cq.loop_step],null),
       'curriculum_questions',cq.question_id,'active',1,
       jsonb_build_object('lens',cq.lens,'theme',cq.theme,'phase',cq.phase,'captured_signal',cq.captured_signal,'support_mode',cq.support_mode,'next_route',cq.next_route)
from public.curriculum_questions cq
on conflict(question_key) do update set question_text=excluded.question_text,domain=excluded.domain,category=excluded.category,metadata=excluded.metadata,updated_at=now();

insert into public.question_sets(set_key,name,purpose,audience,visibility,status,version,metadata)
values('mental_condition_lead_v1','メンタル＆コンディション診断 v1','本人の課題自覚と見込み客理解を同時に行う入口診断','競技者・指導者・保護者を中心に一般利用も可','public','active',1,'{"origin":"2026-09-12"}'::jsonb)
on conflict(set_key) do update set visibility='public',status='active',updated_at=now();

with seed(question_key,question_text,short_label,domain,category,answer_type,config,sort_order,required) as (
values
('mental_v1_role','あなたに最も近い立場を教えてください','立場','profile','context','single_choice','{}'::jsonb,1,true),
('mental_v1_activity','現在取り組んでいる競技・活動を教えてください','競技・活動','profile','context','free_text','{}'::jsonb,2,false),
('mental_v1_goal','現在、最も達成したい目標は何ですか？','達成したい目標','goal','goal_design','free_text','{}'::jsonb,3,true),
('mental_v1_goal_timing','その目標を達成したい時期はいつですか？','目標時期','goal','goal_design','single_choice','{}'::jsonb,4,false),
('mental_v1_goal_3m','自分が3か月後にどうなっていたいか、具体的に説明できる','3か月後の明確さ','mental','goal_design','scale','{"min":1,"max":5}'::jsonb,5,true),
('mental_v1_priority','目標達成のために、今やるべきことの優先順位が分かっている','優先順位','mental','goal_design','scale','{"min":1,"max":5}'::jsonb,6,true),
('mental_v1_values','その目標を達成したい理由が、自分の価値観と結びついている','価値観との接続','mental','goal_design','scale','{"min":1,"max":5}'::jsonb,7,true),
('mental_v1_reset','失敗やミスをしても、比較的早く気持ちを切り替えられる','切り替え','mental','emotion','scale','{"min":1,"max":5}'::jsonb,8,true),
('mental_v1_calm_method','緊張する場面でも、自分を落ち着かせる方法を持っている','落ち着く方法','mental','emotion','scale','{"min":1,"max":5}'::jsonb,9,true),
('mental_v1_emotion_awareness','不安、焦り、怒りなど、自分の感情を客観的に認識できる','感情認識','mental','emotion','scale','{"min":1,"max":5}'::jsonb,10,true),
('mental_v1_body_awareness','呼吸、姿勢、筋肉の緊張など、身体の変化に気づける','身体への気づき','body','body_awareness','scale','{"min":1,"max":5}'::jsonb,11,true),
('mental_v1_routine','本番前に自分を整えるルーティンを持っている','本番前ルーティン','body','body_awareness','scale','{"min":1,"max":5}'::jsonb,12,true),
('mental_v1_best_state','自分が最も力を発揮しやすい身体の状態を理解している','ベスト状態理解','body','body_awareness','scale','{"min":1,"max":5}'::jsonb,13,true),
('mental_v1_small_actions','小さな行動を、無理なく継続できている','小さな継続','behavior','habit','scale','{"min":1,"max":5}'::jsonb,14,true),
('mental_v1_reflection','うまくいかなかった経験を振り返り、次の行動に変えられる','振り返り→行動','behavior','habit','scale','{"min":1,"max":5}'::jsonb,15,true),
('mental_v1_start_action','やる気が出るのを待たず、必要な行動を始められる','行動開始','behavior','habit','scale','{"min":1,"max":5}'::jsonb,16,true),
('mental_v1_main_problem','現在、最も困っていることは何ですか？','最大の困りごと','pain','problem','single_choice','{}'::jsonb,17,true),
('mental_v1_problem_frequency','その悩みは、どのくらいの頻度で起きていますか？','悩みの頻度','pain','problem','single_choice','{}'::jsonb,18,true),
('mental_v1_urgency','その悩みを解決する重要度を教えてください','解決重要度','pain','urgency','scale','{"min":1,"max":5}'::jsonb,19,true),
('mental_v1_after_change','その問題が解決したら、何が一番変わると思いますか？','解決後の変化','goal','desired_change','free_text','{}'::jsonb,20,true),
('mental_v1_support_interest','現在、興味があるサポートを選んでください','興味のあるサポート','offer','interest','multi_choice','{}'::jsonb,21,false),
('mental_v1_support_format','サポートを受ける場合、どの形式が利用しやすいですか？','希望形式','offer','format','single_choice','{}'::jsonb,22,false),
('mental_v1_feedback_interest','15分程度の無料フィードバックを行う場合、受けてみたいですか？','無料FB希望','lead','intent','single_choice','{}'::jsonb,23,false)
), upsert_questions as (
  insert into public.question_bank(question_key,question_text,short_label,domain,category,answer_type,visibility,config,tags,source_type,source_ref,status,version,metadata)
  select question_key,question_text,short_label,domain,category,answer_type,'private',config,array['mental_condition_v1'],'manual_seed','mental_condition_lead_v1','active',1,jsonb_build_object('seed_order',sort_order,'required',required)
  from seed
  on conflict(question_key) do update set question_text=excluded.question_text,short_label=excluded.short_label,domain=excluded.domain,category=excluded.category,answer_type=excluded.answer_type,config=excluded.config,metadata=excluded.metadata,updated_at=now()
  returning id,question_key
)
insert into public.question_set_items(set_id,question_id,sort_order,required)
select qs.id,qb.id,seed.sort_order,seed.required
from seed join public.question_bank qb using(question_key)
join public.question_sets qs on qs.set_key='mental_condition_lead_v1'
on conflict(set_id,question_id) do update set sort_order=excluded.sort_order,required=excluded.required;

with opts(question_key,option_key,label,sort_order,numeric_score) as (
values
('mental_v1_role','athlete','競技者・アスリート',1,null::numeric),('mental_v1_role','coach','スポーツ指導者',2,null),('mental_v1_role','parent','スポーツをしている子どもの保護者',3,null),('mental_v1_role','business','経営者・会社員',4,null),('mental_v1_role','growth','健康や自己成長に関心がある',5,null),('mental_v1_role','other','その他',6,null),
('mental_v1_goal_timing','1m','1か月以内',1,1),('mental_v1_goal_timing','3m','3か月以内',2,2),('mental_v1_goal_timing','6m','半年以内',3,3),('mental_v1_goal_timing','1y','1年以内',4,4),('mental_v1_goal_timing','undecided','時期は決まっていない',5,5),
('mental_v1_main_problem','pressure','本番になると緊張して力を出せない',1,null),('mental_v1_main_problem','mistake','ミスを引きずってしまう',2,null),('mental_v1_main_problem','confidence','自信が持てない',3,null),('mental_v1_main_problem','direction','目標や方向性が定まらない',4,null),('mental_v1_main_problem','continuity','行動を継続できない',5,null),('mental_v1_main_problem','motivation','モチベーションに波がある',6,null),('mental_v1_main_problem','relationship','指導者や家族との関係に悩んでいる',7,null),('mental_v1_main_problem','body','身体の疲労や不調がメンタルに影響している',8,null),('mental_v1_main_problem','verbalize','自分の状態をうまく言葉にできない',9,null),('mental_v1_main_problem','other','その他',10,null),
('mental_v1_problem_frequency','daily','ほぼ毎日',1,4),('mental_v1_problem_frequency','weekly','週に数回',2,3),('mental_v1_problem_frequency','monthly','月に数回',3,2),('mental_v1_problem_frequency','important','重要な場面だけ',4,1),('mental_v1_problem_frequency','none_recent','最近は起きていない',5,0),
('mental_v1_support_interest','diagnosis','自分のメンタル傾向を知る診断',1,null),('mental_v1_support_interest','routine','本番前に心身を整えるルーティン',2,null),('mental_v1_support_interest','anxiety','緊張や不安への対処法',3,null),('mental_v1_support_interest','goal','目標設定と行動計画',4,null),('mental_v1_support_interest','habit','習慣化のサポート',5,null),('mental_v1_support_interest','body','身体感覚や呼吸を使った調整',6,null),('mental_v1_support_interest','coaching','個別のメンタルコーチング',7,null),('mental_v1_support_interest','team','チームや親子向けの講座',8,null),('mental_v1_support_interest','info','情報収集だけしたい',9,null),('mental_v1_support_interest','unknown','まだ分からない',10,null),
('mental_v1_support_format','self','動画や教材で自分のペースで学ぶ',1,null),('mental_v1_support_format','online','オンライン講座に参加する',2,null),('mental_v1_support_format','single','一度だけ個別相談を受ける',3,null),('mental_v1_support_format','ongoing','一定期間、継続的に伴走してもらう',4,null),('mental_v1_support_format','group','チームや親子で受ける',5,null),('mental_v1_support_format','unknown','まだ分からない',6,null),
('mental_v1_feedback_interest','yes','ぜひ受けたい',1,3),('mental_v1_feedback_interest','maybe','内容を見て検討したい',2,1),('mental_v1_feedback_interest','no','今回は必要ない',3,0)
)
insert into public.question_options(question_id,option_key,label,sort_order,numeric_score)
select qb.id,opts.option_key,opts.label,opts.sort_order,opts.numeric_score
from opts join public.question_bank qb on qb.question_key=opts.question_key
on conflict(question_id,option_key) do update set label=excluded.label,sort_order=excluded.sort_order,numeric_score=excluded.numeric_score;
