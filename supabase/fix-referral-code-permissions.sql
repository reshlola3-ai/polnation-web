-- Fix permissions for referral code functions

-- 1. Recreate generate_referral_code with SECURITY DEFINER
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate generate_unique_referral_code with SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_referral_code() TO anon;
GRANT EXECUTE ON FUNCTION generate_referral_code() TO service_role;

GRANT EXECUTE ON FUNCTION generate_unique_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_unique_referral_code() TO anon;
GRANT EXECUTE ON FUNCTION generate_unique_referral_code() TO service_role;

-- 4. Verify handle_new_user is correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_id UUID;
  default_username TEXT;
  new_referral_code TEXT;
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
  -- Log error and still create profile without referral code if something fails
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  INSERT INTO public.profiles (id, email, username, referrer_id)
  VALUES (NEW.id, NEW.email, default_username, ref_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Test the functions
DO $$
DECLARE
  test_code TEXT;
BEGIN
  test_code := generate_unique_referral_code();
  RAISE NOTICE 'Test referral code generated: %', test_code;
END $$;
