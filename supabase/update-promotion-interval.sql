-- Set promotion_post to once per day (24 hours)
UPDATE public.task_types
SET repeat_interval_hours = 24
WHERE task_key = 'promotion_post';
