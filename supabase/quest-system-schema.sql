-- =====================================================
-- Quest System Schema — Chapter-based sequential tasks
-- =====================================================

-- 1. Add quest columns to task_types
ALTER TABLE public.task_types
  ADD COLUMN IF NOT EXISTS quest_group TEXT,
  ADD COLUMN IF NOT EXISTS quest_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_referral_count INTEGER DEFAULT 0;

-- 2. Update existing tasks to belong to Chapter 1 (onboarding)
UPDATE public.task_types SET quest_group = 'ch1', quest_step = 1 WHERE task_key = 'profile_setup';
UPDATE public.task_types SET quest_group = 'ch1', quest_step = 2 WHERE task_key = 'social_twitter';
UPDATE public.task_types SET quest_group = 'ch1', quest_step = 3 WHERE task_key = 'social_telegram';
-- promotion_post moved to ch2, video_review moved to ch3 (updated below)
UPDATE public.task_types SET quest_group = 'ch2', quest_step = 3 WHERE task_key = 'promotion_post';
UPDATE public.task_types SET quest_group = 'ch3', quest_step = 3 WHERE task_key = 'video_review';
-- Retire old community_devotion (replaced by new group tasks)
UPDATE public.task_types SET is_active = false WHERE task_key = 'community_devotion';
-- Retire discord (not needed)
UPDATE public.task_types SET is_active = false WHERE task_key = 'social_discord';

-- 3. Insert new Chapter 1 tasks
INSERT INTO public.task_types
  (task_key, name, description, reward_usd, task_category, is_repeatable, verification_type, sort_order, quest_group, quest_step, requires_referral_count)
VALUES
  (
    'wallet_connect',
    'Activate Merkle Tree & Verify Wallet',
    'Connect your wallet and sign to activate Merkle Tree distribution eligibility and verify wallet ownership.',
    1.0, 'onboarding', false, 'wallet_check', 3, 'ch1', 4, 0
  ),
  (
    'copy_referral_link',
    'Copy & Share Referral Link',
    'Copy your referral link and promotional content to share with friends.',
    0.5, 'onboarding', false, 'auto', 4, 'ch1', 5, 0
  )
ON CONFLICT (task_key) DO NOTHING;

-- 4. Insert new Chapter 2 tasks (Build Group)
INSERT INTO public.task_types
  (task_key, name, description, reward_usd, task_category, is_repeatable, verification_type, sort_order, quest_group, quest_step, requires_referral_count)
VALUES
  (
    'community_group_5',
    'Build a Group (5+ Members)',
    'Create a Telegram or WhatsApp group with 5+ members and notify admin for verification.',
    1.5, 'community', false, 'admin_review', 21, 'ch2', 1, 0
  ),
  (
    'community_group_20',
    'Grow Your Group (20+ Members)',
    'Grow your community group to 20+ members and notify admin for verification.',
    3.0, 'community', false, 'admin_review', 22, 'ch2', 2, 0
  ),
  (
    'invite_1_friend',
    'Invite 1 Friend',
    'Successfully invite 1 friend who registers and binds their wallet.',
    2.0, 'onboarding', false, 'referral_check', 24, 'ch2', 4, 1
  )
ON CONFLICT (task_key) DO NOTHING;

-- 5. Insert new Chapter 3 tasks (Recruit)
INSERT INTO public.task_types
  (task_key, name, description, reward_usd, task_category, is_repeatable, verification_type, sort_order, quest_group, quest_step, requires_referral_count)
VALUES
  (
    'invite_3_friends',
    'Invite 3 Friends',
    'Successfully invite 3 friends who register and bind their wallets.',
    3.0, 'onboarding', false, 'referral_check', 31, 'ch3', 1, 3
  ),
  (
    'invite_10_friends',
    'Invite 10 Friends',
    'Successfully invite 10 friends who register and bind their wallets.',
    8.0, 'onboarding', false, 'referral_check', 32, 'ch3', 2, 10
  ),
  (
    'invite_30_friends',
    'Invite 30 Friends',
    'Successfully invite 30 friends who register and bind their wallets.',
    20.0, 'onboarding', false, 'referral_check', 34, 'ch3', 4, 30
  )
ON CONFLICT (task_key) DO NOTHING;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_task_types_quest_group ON public.task_types(quest_group);
CREATE INDEX IF NOT EXISTS idx_task_types_quest_step ON public.task_types(quest_group, quest_step);
