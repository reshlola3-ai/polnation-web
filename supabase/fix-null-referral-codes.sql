-- =====================================================
-- Fix: Backfill NULL referral_codes for all users
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. First, check how many users have NULL referral_code
SELECT COUNT(*) AS users_without_referral_code 
FROM public.profiles 
WHERE referral_code IS NULL;

-- 2. Backfill: Generate unique referral_code for all users who don't have one
DO $$
DECLARE
  profile_record RECORD;
  new_code TEXT;
BEGIN
  FOR profile_record IN 
    SELECT id, username FROM public.profiles WHERE referral_code IS NULL 
  LOOP
    new_code := generate_unique_referral_code();
    UPDATE public.profiles 
    SET referral_code = new_code
    WHERE id = profile_record.id;
    RAISE NOTICE 'Generated referral_code % for user % (%)', new_code, profile_record.username, profile_record.id;
  END LOOP;
END $$;

-- 3. Verify: No more NULL referral_codes
SELECT id, username, email, referral_code, profile_completed
FROM public.profiles
WHERE referral_code IS NULL;

-- 4. Fix the handle_new_user trigger EXCEPTION branch to include referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_id UUID;
  default_username TEXT;
  new_referral_code TEXT;
  fallback_code TEXT;
BEGIN
  -- Get referrer_id from metadata
  BEGIN
    ref_id := (NEW.raw_user_meta_data->>'referrer_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    ref_id := NULL;
  END;
  
  -- Generate default username
  default_username := SPLIT_PART(NEW.email, '@', 1);
  
  -- Ensure unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = default_username) LOOP
    default_username := default_username || FLOOR(RANDOM() * 1000)::TEXT;
  END LOOP;
  
  -- Generate unique referral_code
  new_referral_code := generate_unique_referral_code();
  
  -- Insert profile
  INSERT INTO public.profiles (id, email, username, referrer_id, referral_code)
  VALUES (NEW.id, NEW.email, default_username, ref_id, new_referral_code);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but STILL generate referral_code in fallback
  RAISE WARNING 'handle_new_user error: %, attempting fallback with referral_code', SQLERRM;
  BEGIN
    fallback_code := generate_unique_referral_code();
  EXCEPTION WHEN OTHERS THEN
    -- Last resort: use random 4-char code directly
    fallback_code := substr(md5(random()::text), 1, 4);
  END;
  INSERT INTO public.profiles (id, email, username, referrer_id, referral_code)
  VALUES (NEW.id, NEW.email, default_username, ref_id, fallback_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
