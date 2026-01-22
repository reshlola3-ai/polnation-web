-- =====================================================
-- Add short referral_code to profiles
-- =====================================================

-- 1. Add referral_code column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- 3. Function to generate random 4-character alphanumeric code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars: 0,O,1,I
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := generate_referral_code();
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 5. Generate codes for existing users who don't have one
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles 
    SET referral_code = generate_unique_referral_code()
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- 6. Update handle_new_user function to auto-generate referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_id UUID;
  default_username TEXT;
  new_referral_code TEXT;
BEGIN
  -- 从 metadata 获取 referrer_id
  ref_id := (NEW.raw_user_meta_data->>'referrer_id')::UUID;
  
  -- 生成默认用户名（邮箱前缀）
  default_username := SPLIT_PART(NEW.email, '@', 1);
  
  -- 确保用户名唯一
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = default_username) LOOP
    default_username := default_username || FLOOR(RANDOM() * 1000)::TEXT;
  END LOOP;
  
  -- 生成唯一的 referral_code
  new_referral_code := generate_unique_referral_code();
  
  INSERT INTO public.profiles (id, email, username, referrer_id, referral_code)
  VALUES (NEW.id, NEW.email, default_username, ref_id, new_referral_code);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Make referral_code NOT NULL for future inserts (after existing users have codes)
-- Note: Run this after confirming all users have codes
-- ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;
