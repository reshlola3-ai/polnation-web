-- =====================================================
-- 任务系统 (Tasks System)
-- =====================================================

-- =====================
-- 1. 任务类型配置表
-- =====================
CREATE TABLE IF NOT EXISTS public.task_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_key TEXT UNIQUE NOT NULL,           -- 任务唯一标识: 'social_twitter', 'social_telegram', 'promotion', 'checkin', 'video'
  name TEXT NOT NULL,                       -- 任务名称
  description TEXT,                         -- 任务描述
  reward_usd DECIMAL(18,6) NOT NULL,        -- 奖励金额 (USD)
  task_category TEXT NOT NULL,              -- 分类: 'social', 'promotion', 'checkin', 'video'
  
  -- 任务配置
  is_repeatable BOOLEAN DEFAULT false,      -- 是否可重复完成
  repeat_interval_hours INTEGER,            -- 重复间隔（小时），null=无限制
  requires_verification BOOLEAN DEFAULT false, -- 是否需要验证
  verification_type TEXT,                   -- 验证类型: 'auto_return', 'link_check', 'manual', 'checkin'
  
  -- 社交媒体配置
  social_url TEXT,                          -- 社交媒体链接
  
  -- Promotion配置
  required_keyword TEXT,                    -- 必须包含的关键词
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 2. 用户任务完成记录
-- =====================
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  task_type_id UUID REFERENCES public.task_types(id) ON DELETE CASCADE NOT NULL,
  
  -- 完成状态
  status TEXT DEFAULT 'pending',            -- pending, completed, rejected
  completed_at TIMESTAMPTZ,
  
  -- 提交内容（用于promotion/video）
  submitted_url TEXT,
  submitted_content TEXT,
  
  -- 验证结果
  verification_passed BOOLEAN,
  verification_note TEXT,
  verified_at TIMESTAMPTZ,
  
  -- 奖励
  reward_usd DECIMAL(18,6),
  reward_credited BOOLEAN DEFAULT false,    -- 是否已计入解锁进度
  reward_credited_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 3. 用户签到记录
-- =====================
CREATE TABLE IF NOT EXISTS public.user_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  checkin_date DATE NOT NULL,
  streak_count INTEGER DEFAULT 1,           -- 当前连续签到天数
  bonus_earned BOOLEAN DEFAULT false,       -- 是否获得连续签到奖励
  bonus_amount DECIMAL(18,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, checkin_date)
);

-- =====================
-- 4. 用户任务进度（解锁进度增量）
-- =====================
CREATE TABLE IF NOT EXISTS public.user_task_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- 累计从任务获得的解锁进度
  total_task_bonus DECIMAL(18,6) DEFAULT 0,
  
  -- 签到相关
  current_streak INTEGER DEFAULT 0,         -- 当前连续签到天数
  last_checkin_date DATE,
  total_checkins INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =====================
-- 5. 插入默认任务类型
-- =====================
INSERT INTO public.task_types (task_key, name, description, reward_usd, task_category, is_repeatable, verification_type, social_url, required_keyword, sort_order) VALUES
  -- 社交媒体任务
  ('social_twitter', 'Follow on Twitter', 'Follow our official Twitter account', 0.5, 'social', false, 'auto_return', 'https://twitter.com/polnation', NULL, 1),
  ('social_telegram', 'Join Telegram', 'Join our Telegram community', 0.5, 'social', false, 'auto_return', 'https://t.me/polnation', NULL, 2),
  ('social_discord', 'Join Discord', 'Join our Discord server', 0.5, 'social', false, 'auto_return', 'https://discord.gg/polnation', NULL, 3),
  
  -- Promotion任务
  ('promotion_post', 'Share Promotion', 'Share about Polnation on social media (must include "polnation")', 1.0, 'promotion', true, 'link_check', NULL, 'polnation', 10),
  
  -- 签到任务
  ('daily_checkin', 'Daily Check-in', 'Check in daily. 7-day streak = $1 bonus!', 0.1, 'checkin', true, 'checkin', NULL, NULL, 20),
  
  -- 视频任务
  ('video_review', 'Video Review', 'Create a video review about Polnation', 2.0, 'video', true, 'manual', NULL, 'polnation', 30)
ON CONFLICT (task_key) DO NOTHING;

-- =====================
-- 6. 函数：获取用户有效解锁进度
-- =====================
-- 有效解锁进度 = L1-L3下线volume + 任务奖励进度
CREATE OR REPLACE FUNCTION public.get_effective_unlock_volume(target_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  team_volume DECIMAL(18,6) := 0;
  task_bonus DECIMAL(18,6) := 0;
BEGIN
  -- 获取L1-L3团队volume
  SELECT COALESCE(ucs.team_volume_l123, 0) INTO team_volume
  FROM public.user_community_status ucs
  WHERE ucs.user_id = target_user_id;
  
  -- 获取任务奖励进度
  SELECT COALESCE(utp.total_task_bonus, 0) INTO task_bonus
  FROM public.user_task_progress utp
  WHERE utp.user_id = target_user_id;
  
  RETURN team_volume + task_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- 7. 索引
-- =====================
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_checkins_user_date ON public.user_checkins(user_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_user_task_progress_user_id ON public.user_task_progress(user_id);

-- =====================
-- 8. RLS 策略
-- =====================
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_progress ENABLE ROW LEVEL SECURITY;

-- 公开读取任务类型
CREATE POLICY "Anyone can read task types" ON public.task_types
  FOR SELECT USING (true);

-- 用户只能读写自己的任务记录
CREATE POLICY "Users can read own tasks" ON public.user_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON public.user_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own checkins" ON public.user_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins" ON public.user_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own task progress" ON public.user_task_progress
  FOR SELECT USING (auth.uid() = user_id);
