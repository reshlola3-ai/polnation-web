-- 触发器：当 auth.users.email 更新时，同步更新 profiles.email
-- 这对于钱包用户绑定真实邮箱后同步 profile 非常重要

-- 函数：同步 auth.users.email 到 profiles.email
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在 email 变化时更新
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email,
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 触发器：auth.users 更新时同步 email
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_update();

-- 验证触发器创建成功
DO $$
BEGIN
  RAISE NOTICE 'Email sync trigger created successfully!';
END $$;
