-- Update Twitter link to x.com/polnation_glb
UPDATE public.task_types 
SET social_url = 'https://x.com/polnation_glb'
WHERE task_key = 'social_twitter';
