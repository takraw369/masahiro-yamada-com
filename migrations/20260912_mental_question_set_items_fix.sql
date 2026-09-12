-- Data-modifying CTE inserts are not visible to sibling reads in the same statement snapshot.
-- Link the already-upserted question rows to the mental questionnaire in a follow-up migration.
with seed(question_key,sort_order,required) as (
values
('mental_v1_role',1,true),('mental_v1_activity',2,false),('mental_v1_goal',3,true),('mental_v1_goal_timing',4,false),
('mental_v1_goal_3m',5,true),('mental_v1_priority',6,true),('mental_v1_values',7,true),('mental_v1_reset',8,true),
('mental_v1_calm_method',9,true),('mental_v1_emotion_awareness',10,true),('mental_v1_body_awareness',11,true),('mental_v1_routine',12,true),
('mental_v1_best_state',13,true),('mental_v1_small_actions',14,true),('mental_v1_reflection',15,true),('mental_v1_start_action',16,true),
('mental_v1_main_problem',17,true),('mental_v1_problem_frequency',18,true),('mental_v1_urgency',19,true),('mental_v1_after_change',20,true),
('mental_v1_support_interest',21,false),('mental_v1_support_format',22,false),('mental_v1_feedback_interest',23,false)
)
insert into public.question_set_items(set_id,question_id,sort_order,required)
select qs.id,qb.id,s.sort_order,s.required
from seed s
join public.question_bank qb on qb.question_key=s.question_key
join public.question_sets qs on qs.set_key='mental_condition_lead_v1'
on conflict(set_id,question_id) do update set sort_order=excluded.sort_order,required=excluded.required;
