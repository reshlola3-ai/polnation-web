-- Alpha Lead Tracker — migrate from wallet-based to entity-based tracking.
-- Arkham /transfers accepts an entity_id (e.g. "wintermute") as `base` and
-- aggregates that entity's activity across ALL its wallets and chains, so we
-- track 11 curated entities instead of individual wallet addresses.

DROP TABLE IF EXISTS public.alpha_signals;
DROP TABLE IF EXISTS public.alpha_wallets;

CREATE TABLE public.alpha_entities (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         text        UNIQUE NOT NULL,        -- Arkham entity slug, e.g. "wintermute"
  display_name      text        NOT NULL,                -- "Wintermute"
  entity_type       text        NOT NULL,                -- "fund", "market_maker", "individual"
  pnl_30d           numeric     NOT NULL DEFAULT 0,
  portfolio_usd     numeric     NOT NULL DEFAULT 0,
  is_active         boolean     NOT NULL DEFAULT true,
  last_refreshed_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alpha_signals (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id              text        NOT NULL,
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
  expires_at             timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX alpha_signals_observed_at_idx  ON public.alpha_signals (observed_at DESC);
CREATE INDEX alpha_signals_pattern_idx      ON public.alpha_signals (pattern_id);
CREATE INDEX alpha_signals_expires_idx      ON public.alpha_signals (expires_at);
CREATE INDEX alpha_signals_token_idx        ON public.alpha_signals (token_symbol, observed_at DESC);
CREATE INDEX alpha_entities_active_idx      ON public.alpha_entities (is_active) WHERE is_active = true;

ALTER TABLE public.alpha_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alpha_signals  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alpha_entities_anon_read" ON public.alpha_entities FOR SELECT TO anon         USING (is_active = true);
CREATE POLICY "alpha_entities_service"   ON public.alpha_entities FOR ALL    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "alpha_signals_anon_read"  ON public.alpha_signals FOR SELECT TO anon         USING (expires_at > now());
CREATE POLICY "alpha_signals_service"    ON public.alpha_signals FOR ALL    TO service_role USING (true) WITH CHECK (true);
