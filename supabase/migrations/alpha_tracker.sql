-- Alpha Lead Tracker tables
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.alpha_wallets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  address           text        UNIQUE NOT NULL,
  arkham_entity     text,
  entity_type       text,
  chains            text[]      NOT NULL DEFAULT '{}',
  pnl_30d           numeric     NOT NULL DEFAULT 0,
  win_rate          numeric     NOT NULL DEFAULT 0,
  portfolio_usd     numeric     NOT NULL DEFAULT 0,
  is_active         boolean     NOT NULL DEFAULT true,
  last_refreshed_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alpha_signals (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address         text        NOT NULL,
  entity_name            text        NOT NULL,
  pattern_id             text        NOT NULL,
  confidence             smallint    NOT NULL,
  confidence_breakdown   jsonb       NOT NULL DEFAULT '{}',
  tx_hashes              text[]      NOT NULL DEFAULT '{}',
  chain                  text,
  token_symbol           text,
  token_address          text,
  amount_usd             numeric,
  what_text              text        NOT NULL,
  meaning_text           text        NOT NULL,
  observed_at            timestamptz NOT NULL DEFAULT now(),
  expires_at             timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS alpha_signals_observed_at_idx  ON public.alpha_signals (observed_at DESC);
CREATE INDEX IF NOT EXISTS alpha_signals_pattern_idx      ON public.alpha_signals (pattern_id);
CREATE INDEX IF NOT EXISTS alpha_signals_expires_idx      ON public.alpha_signals (expires_at);
CREATE INDEX IF NOT EXISTS alpha_signals_token_idx        ON public.alpha_signals (token_symbol, observed_at DESC);
CREATE INDEX IF NOT EXISTS alpha_wallets_active_idx       ON public.alpha_wallets (is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.alpha_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alpha_signals  ENABLE ROW LEVEL SECURITY;

-- anon: read active wallets + non-expired signals
CREATE POLICY "alpha_wallets_anon_read"  ON public.alpha_wallets FOR SELECT TO anon        USING (is_active = true);
CREATE POLICY "alpha_wallets_service"    ON public.alpha_wallets FOR ALL    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "alpha_signals_anon_read"  ON public.alpha_signals FOR SELECT TO anon        USING (expires_at > now());
CREATE POLICY "alpha_signals_service"    ON public.alpha_signals FOR ALL    TO service_role USING (true) WITH CHECK (true);
