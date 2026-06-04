-- =====================================================================
-- 钱包绑定：永久不可变 + 审计留痕
-- 一旦 profiles.wallet_address 从空绑定为某地址，之后任何把它改成别的
-- 地址（或改回空）的操作，都在数据库层被拒绝 —— 前端 bug、API、甚至手动
-- SQL 都改不动。所有首次绑定 + 被拦截的换绑尝试都会留痕。
--
-- 在 Supabase → SQL Editor 直接整段运行即可（可重复执行）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 审计表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_binding_audit (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event        TEXT NOT NULL,          -- 'bound' (首次绑定) | 'change_blocked' (被拦截的换绑尝试)
  old_address  TEXT,                   -- 原地址（首次绑定为 NULL）
  new_address  TEXT,                   -- 涉及的地址
  source       TEXT,                   -- 来源：'profile_page' | 'bind_wallet_api' | 'db_trigger' | ...
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_audit_user    ON public.wallet_binding_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_audit_created ON public.wallet_binding_audit(created_at DESC);

-- 只允许服务端读写（service role 绕过 RLS；不给任何 user policy = 普通用户读不到）
ALTER TABLE public.wallet_binding_audit ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2) 不可变约束：已绑定的钱包禁止被改成别的地址（或改回空）
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_wallet_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.wallet_address IS NOT NULL
     AND NEW.wallet_address IS DISTINCT FROM OLD.wallet_address THEN
    RAISE EXCEPTION
      'wallet_address is immutable once bound (user %, current %, attempted %)',
      OLD.id, OLD.wallet_address, NEW.wallet_address
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallet_immutable ON public.profiles;
CREATE TRIGGER trg_wallet_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wallet_immutable();

-- ---------------------------------------------------------------------
-- 3) 成功绑定留痕：钱包从空 → 有值时，自动记一条 'bound'
--    （覆盖所有绑定入口，无需逐个改代码）
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_wallet_bound()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.wallet_address IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.wallet_address IS NULL AND NEW.wallet_address IS NOT NULL) THEN
    INSERT INTO public.wallet_binding_audit (user_id, event, old_address, new_address, source)
    VALUES (NEW.id, 'bound', NULL, NEW.wallet_address, 'db_trigger');
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_wallet_bound ON public.profiles;
CREATE TRIGGER trg_log_wallet_bound
  AFTER INSERT OR UPDATE OF wallet_address ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_wallet_bound();
