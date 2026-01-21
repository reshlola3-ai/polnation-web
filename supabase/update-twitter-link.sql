-- Update Twitter link to x.com/polnation_glb
UPDATE public.task_types 
SET social_url = 'https://x.com/polnation_glb'
WHERE task_key = 'social_twitter';

-- Change Discord to WhatsApp
UPDATE public.task_types 
SET 
  task_key = 'social_whatsapp',
  name = 'Join WhatsApp',
  description = 'Join our WhatsApp community',
  social_url = 'https://chat.whatsapp.com/Bi4tUbc9euP17b4wzRPTYD'
WHERE task_key = 'social_discord';

-- Add Facebook task (only if not exists)
INSERT INTO public.task_types (task_key, name, description, reward_usd, task_category, is_repeatable, verification_type, social_url, sort_order) 
VALUES (
  'social_facebook', 
  'Follow Facebook', 
  'Follow our official Facebook page', 
  0.5, 
  'social', 
  false, 
  'auto_return', 
  'https://www.facebook.com/profile.php?id=61586884562343', 
  4
)
ON CONFLICT (task_key) DO NOTHING;
