-- =====================================================
-- New Tasks Schema Update
-- =====================================================

-- 1. Add Community Devotion task
INSERT INTO public.task_types (task_key, name, description, reward_usd, task_category, is_repeatable, verification_type, sort_order)
VALUES (
  'community_devotion', 
  'Community Devotion', 
  'Create a community over 40 members and submit your group link for verification.', 
  5.0, 
  'community',  -- new category
  false, 
  'admin_review',
  20
)
ON CONFLICT (task_key) DO NOTHING;

-- 2. Update Video Tasks - change to variable reward (display as 10-50)
-- The actual reward will be set by admin during approval
UPDATE public.task_types
SET 
  reward_usd = 10,  -- minimum reward (display will show $10-50)
  description = 'Create and share a video review about Polnation. Reward: $10-50 based on quality.'
WHERE task_key = 'video_review';

-- 3. Update Share Promotion - add daily note
UPDATE public.task_types
SET description = 'Share about Polnation on social media (Daily Task - submit once per day)'
WHERE task_key = 'promotion_post';

-- 4. Add status column to user_tasks if not exists
ALTER TABLE public.user_tasks 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'approved', 'rejected', 'completed'));

-- 5. Add admin_reward_amount for variable rewards
ALTER TABLE public.user_tasks 
ADD COLUMN IF NOT EXISTS admin_reward_amount DECIMAL(10,2);

-- 6. Add submitted_url column to store user submissions
ALTER TABLE public.user_tasks 
ADD COLUMN IF NOT EXISTS submitted_url TEXT;

-- 7. Create referral_task_bonus table to track referral bonuses
CREATE TABLE IF NOT EXISTS public.referral_task_bonus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  UNIQUE(user_id, referred_user_id)
);

-- 8. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_referral_task_bonus_user ON public.referral_task_bonus(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_task_bonus_status ON public.referral_task_bonus(status);

-- 9. Enable RLS
ALTER TABLE public.referral_task_bonus ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies
CREATE POLICY "Users can view own referral bonuses" ON public.referral_task_bonus
  FOR SELECT USING (auth.uid() = user_id);

-- 11. Function to automatically create referral bonus when new user binds wallet
CREATE OR REPLACE FUNCTION public.create_referral_task_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when wallet_address is being set (not null and was null before)
  IF NEW.wallet_address IS NOT NULL AND (OLD.wallet_address IS NULL OR OLD.wallet_address = '') THEN
    -- Check if user has a referrer and was registered with email (not wallet)
    IF NEW.referrer_id IS NOT NULL AND NEW.email NOT LIKE '%@wallet.polnation.com' THEN
      -- Create bonus record for the referrer
      INSERT INTO public.referral_task_bonus (user_id, referred_user_id, bonus_amount, status)
      VALUES (NEW.referrer_id, NEW.id, 1.0, 'pending')
      ON CONFLICT (user_id, referred_user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create trigger
DROP TRIGGER IF EXISTS trigger_create_referral_task_bonus ON public.profiles;
CREATE TRIGGER trigger_create_referral_task_bonus
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_referral_task_bonus();
