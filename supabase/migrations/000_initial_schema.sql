-- ============================================================
-- 000 — INITIAL SCHEMA (idempotent, safe to re-run)
-- All CREATE TABLE ... IF NOT EXISTS
-- All triggers use DROP TRIGGER IF EXISTS first
-- All RLS policies use DO $$ IF NOT EXISTS pattern
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────

create table if not exists products (
  id            uuid          primary key default gen_random_uuid(),
  name_en       text          not null,
  name_kn       text          not null,
  description_en text,
  description_kn text,
  price         numeric(10,2) not null,
  category      text          not null default 'main'
                              check (category in ('main','snack','drink','dessert')),
  image_url     text,
  is_available  boolean       not null default true,
  sort_order    integer       not null default 0,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create table if not exists orders (
  id                uuid         primary key default gen_random_uuid(),
  token_number      integer      not null,
  order_date        date         not null default current_date,
  order_type        text         not null check (order_type in ('dine_in','parcel')),
  status            text         not null default 'ordered'
                                 check (status in ('ordered','ready','delivered','cancelled')),
  payment_method    text         check (payment_method in ('online','cash')),
  payment_status    text         not null default 'unpaid'
                                 check (payment_status in ('unpaid','paid','failed','refunded')),
  subtotal          numeric(10,2) not null default 0,
  parcel_charge     numeric(10,2) not null default 0,
  total_amount      numeric(10,2) not null default 0,
  razorpay_order_id text,
  notes             text,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

create table if not exists order_items (
  id              uuid          primary key default gen_random_uuid(),
  order_id        uuid          not null references orders(id) on delete cascade,
  product_id      uuid          not null references products(id),
  product_name_en text          not null,
  product_name_kn text          not null,
  unit_price      numeric(10,2) not null,
  quantity        integer       not null check (quantity > 0),
  subtotal        numeric(10,2) not null,
  created_at      timestamptz   not null default now()
);

create table if not exists payments (
  id                   uuid          primary key default gen_random_uuid(),
  order_id             uuid          not null unique references orders(id) on delete cascade,
  razorpay_order_id    text,
  razorpay_payment_id  text,
  razorpay_signature   text,
  amount               numeric(10,2) not null,
  currency             text          not null default 'INR',
  method               text,
  status               text          not null default 'created'
                                     check (status in ('created','authorized','captured','failed','refunded')),
  webhook_payload      jsonb,
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now()
);

create table if not exists daily_token_counters (
  order_date  date    primary key,
  last_token  integer not null default 0
);

create table if not exists expenses (
  id           uuid          primary key default gen_random_uuid(),
  expense_date date          not null default current_date,
  category     text          not null
               check (category in ('raw_materials','labour','gas','packaging','other')),
  description  text          not null,
  amount       numeric(10,2) not null,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

create table if not exists cash_entries (
  id         uuid          primary key default gen_random_uuid(),
  entry_date date          not null default current_date,
  amount     numeric(10,2) not null,
  notes      text,
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now()
);

create table if not exists settings (
  key         text        primary key,
  value       text        not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- Default settings (idempotent)
insert into settings (key, value, description) values
  ('parcel_charge',    '10',           'Extra charge per parcel order in INR'),
  ('admin_pin',        '1234',         '4-digit admin PIN'),
  ('store_name_en',    'FoodCart',     'Store name in English'),
  ('store_name_kn',    'ಫುಡ್ ಕಾರ್ಟ್',  'Store name in Kannada'),
  ('store_tagline',    'Fresh Rice Bath Daily', 'Store tagline'),
  ('upi_id',           '',             'UPI ID for payment'),
  ('razorpay_enabled', 'true',         'Enable Razorpay payments'),
  ('payment_mode',     'razorpay',     'Payment mode: upi or razorpay')
on conflict (key) do nothing;

-- Seed menu (idempotent — insert products only if table is empty)
do $$
begin
  if not exists (select 1 from products limit 1) then
    insert into products (name_en, name_kn, description_en, description_kn, price, category, sort_order) values
      ('Bisi Bele Bath',   'ಬಿಸಿ ಬೇಳೆ ಬಾತ್',   'Hot lentil rice with vegetables and spices',  'ತರಕಾರಿ ಮತ್ತು ಮಸಾಲೆಯೊಂದಿಗೆ ಬೇಳೆ ಅನ್ನ',   60, 'main',    1),
      ('Vangi Bath',       'ವಾಂಗಿ ಬಾತ್',         'Spiced brinjal rice with fresh masala',       'ತಾಜಾ ಮಸಾಲೆಯೊಂದಿಗೆ ಬದನೆಕಾಯಿ ಅನ್ನ',        55, 'main',    2),
      ('Puliyogare',       'ಪುಳಿಯೋಗರೆ',           'Tangy tamarind rice with peanuts',            'ಶೇಂಗಾ ಹಾಕಿದ ಹುಣಸೆ ಅನ್ನ',                 50, 'main',    3),
      ('Chitranna',        'ಚಿತ್ರಾನ್ನ',            'Lemon rice with mustard and curry leaves',   'ಸಾಸಿವೆ ಮತ್ತು ಕರಿಬೇವು ಹಾಕಿದ ನಿಂಬೆ ಅನ್ನ', 45, 'main',    4),
      ('Curd Rice',        'ಮೊಸರು ಅನ್ನ',          'Cooling curd rice with pomegranate',          'ದಾಳಿಂಬೆ ಹಾಕಿದ ತಣ್ಣನೆ ಮೊಸರು ಅನ್ನ',        50, 'main',    5),
      ('Tomato Bath',      'ಟೊಮ್ಯಾಟೊ ಬಾತ್',       'Tangy tomato rice with aromatic spices',     'ಸುಗಂಧ ಮಸಾಲೆಯ ಟೊಮ್ಯಾಟೊ ಅನ್ನ',             50, 'main',    6),
      ('Coconut Rice',     'ತೆಂಗಿನ ಅನ್ನ',          'Fragrant coconut rice with cashews',         'ಗೋಡಂಬಿ ಹಾಕಿದ ತೆಂಗಿನಕಾಯಿ ಅನ್ನ',           55, 'main',    7),
      ('Sambar Rice',      'ಸಾಂಬಾರ್ ಅನ್ನ',         'Classic sambar with steamed rice',           'ಕ್ಲಾಸಿಕ್ ಸಾಂಬಾರ್ ಮತ್ತು ಬೇಯಿಸಿದ ಅನ್ನ',    55, 'main',    8),
      ('Kosambari',        'ಕೋಸಂಬರಿ',              'Fresh lentil salad with cucumber',           'ಸೌತೆಕಾಯಿ ಹಾಕಿದ ತಾಜಾ ಬೇಳೆ ಸಲಾಡ್',         30, 'snack',   9),
      ('Papad',            'ಪಾಪಡ್',                'Crispy roasted papad',                       'ಕರಕರಿ ಸುಟ್ಟ ಪಾಪಡ್',                       10, 'snack',  10),
      ('Buttermilk',       'ಮಜ್ಜಿಗೆ',              'Chilled spiced buttermilk',                  'ತಣ್ಣನೆ ಮಸಾಲೆ ಮಜ್ಜಿಗೆ',                    20, 'drink',  11),
      ('Water Bottle',     'ನೀರಿನ ಬಾಟಲಿ',          '1 litre packaged water',                     '1 ಲೀಟರ್ ಶುದ್ಧ ನೀರು',                      20, 'drink',  12),
      ('Sweet Pongal',     'ಸಕ್ಕರೆ ಪೊಂಗಲ್',         'Sweet rice with jaggery and ghee',           'ಬೆಲ್ಲ ಮತ್ತು ತುಪ್ಪ ಹಾಕಿದ ಸಿಹಿ ಅನ್ನ',      40, 'dessert',13),
      ('Payasa',           'ಪಾಯಸ',                 'Traditional rice kheer with cardamom',       'ಏಲಕ್ಕಿ ಹಾಕಿದ ಸಾಂಪ್ರದಾಯಿಕ ಅನ್ನ ಪಾಯಸ',     35, 'dessert',14);
  end if;
end $$;

-- ── Functions (OR REPLACE = always safe) ────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function get_next_token(p_date date)
returns integer as $$
declare
  v_token integer;
begin
  insert into daily_token_counters (order_date, last_token)
  values (p_date, 1)
  on conflict (order_date) do update
    set last_token = daily_token_counters.last_token + 1
  returning last_token into v_token;
  return v_token;
end;
$$ language plpgsql;

-- ── Triggers (DROP IF EXISTS first = idempotent) ─────────────

drop trigger if exists set_products_updated_at   on products;
drop trigger if exists set_orders_updated_at     on orders;
drop trigger if exists set_payments_updated_at   on payments;
drop trigger if exists set_expenses_updated_at   on expenses;
drop trigger if exists set_cash_entries_updated_at on cash_entries;

create trigger set_products_updated_at
  before update on products
  for each row execute function update_updated_at_column();

create trigger set_orders_updated_at
  before update on orders
  for each row execute function update_updated_at_column();

create trigger set_payments_updated_at
  before update on payments
  for each row execute function update_updated_at_column();

create trigger set_expenses_updated_at
  before update on expenses
  for each row execute function update_updated_at_column();

create trigger set_cash_entries_updated_at
  before update on cash_entries
  for each row execute function update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────

alter table products             enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table payments             enable row level security;
alter table expenses             enable row level security;
alter table cash_entries         enable row level security;
alter table settings             enable row level security;
alter table daily_token_counters enable row level security;

-- Idempotent policy creation
do $$ begin
  -- products
  if not exists (select 1 from pg_policies where tablename='products' and policyname='products_public_read') then
    create policy "products_public_read" on products for select using (true);
  end if;
  -- orders
  if not exists (select 1 from pg_policies where tablename='orders' and policyname='orders_public_insert') then
    create policy "orders_public_insert" on orders for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='orders' and policyname='orders_public_read') then
    create policy "orders_public_read" on orders for select using (true);
  end if;
  -- order_items
  if not exists (select 1 from pg_policies where tablename='order_items' and policyname='order_items_public_insert') then
    create policy "order_items_public_insert" on order_items for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='order_items' and policyname='order_items_public_read') then
    create policy "order_items_public_read" on order_items for select using (true);
  end if;
  -- payments
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='payments_public_insert') then
    create policy "payments_public_insert" on payments for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='payments_public_read') then
    create policy "payments_public_read" on payments for select using (true);
  end if;
  -- settings
  if not exists (select 1 from pg_policies where tablename='settings' and policyname='settings_public_read') then
    create policy "settings_public_read" on settings for select using (true);
  end if;
  -- daily_token_counters
  if not exists (select 1 from pg_policies where tablename='daily_token_counters' and policyname='tokens_public_all') then
    create policy "tokens_public_all" on daily_token_counters for all using (true);
  end if;
end $$;

-- ── Realtime ─────────────────────────────────────────────────

alter table orders      replica identity full;
alter table order_items replica identity full;
alter table payments    replica identity full;

do $$ begin
  begin
    alter publication supabase_realtime add table orders;
  exception when others then null; end;
  begin
    alter publication supabase_realtime add table order_items;
  exception when others then null; end;
  begin
    alter publication supabase_realtime add table payments;
  exception when others then null; end;
end $$;
