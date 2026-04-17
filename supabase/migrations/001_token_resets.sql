-- ============================================================
-- TOKEN RESETS TABLE
-- Tracks every time the daily token counter is manually reset.
-- This lets the owner see cumulative orders served across resets.
-- ============================================================

create table if not exists token_resets (
  id            uuid         primary key default uuid_generate_v4(),
  reset_at      timestamptz  not null default now(),
  reset_date    date         not null default current_date,
  tokens_used   integer      not null default 0,   -- last_token value before reset
  total_orders  integer      not null default 0,   -- total orders in DB at time of reset
  note          text,
  created_at    timestamptz  not null default now()
);

-- Index for quick date queries
create index if not exists idx_token_resets_reset_date on token_resets(reset_date);

-- RLS — service role only (admin protected via PIN at API layer)
alter table token_resets enable row level security;
create policy "token_resets_service_all" on token_resets for all using (true);

-- ============================================================
-- RESET TOKEN FUNCTION
-- Atomically: log the reset + zero out today's counter
-- ============================================================
create or replace function reset_daily_token(p_date date, p_note text default null)
returns json as $$
declare
  v_tokens_used  integer := 0;
  v_total_orders integer := 0;
  v_reset_id     uuid;
begin
  -- Get current last_token for the day
  select coalesce(last_token, 0)
  into v_tokens_used
  from daily_token_counters
  where order_date = p_date;

  -- Count total orders ever in the system (cumulative across all resets)
  select count(*) into v_total_orders from orders;

  -- Log the reset
  insert into token_resets (reset_date, tokens_used, total_orders, note)
  values (p_date, v_tokens_used, v_total_orders, p_note)
  returning id into v_reset_id;

  -- Zero out today's counter (next order will get token #1 again)
  update daily_token_counters
  set last_token = 0
  where order_date = p_date;

  -- If no row existed yet, insert it at 0
  insert into daily_token_counters (order_date, last_token)
  values (p_date, 0)
  on conflict (order_date) do nothing;

  return json_build_object(
    'reset_id', v_reset_id,
    'tokens_used', v_tokens_used,
    'total_orders', v_total_orders
  );
end;
$$ language plpgsql security definer;
