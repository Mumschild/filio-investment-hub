create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  phone text not null default '',
  country text not null default '',
  bio text not null default '',
  balance bigint not null default 0 check (balance >= 0),
  total_profit bigint not null default 0 check (total_profit >= 0),
  active_earnings bigint not null default 0 check (active_earnings >= 0),
  unlocked_plans text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('bronze', 'silver', 'platinum', 'gold')),
  quantity integer not null check (quantity between 1 and 20),
  amount bigint not null check (amount > 0),
  receipt_name text not null,
  receipt_data text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount >= 5000),
  account_name text not null,
  bank_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  transaction_type text not null,
  amount bigint not null,
  reference_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  icon text not null,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists deposit_requests_pending_idx on public.deposit_requests (status, created_at);
create index if not exists withdrawal_requests_pending_idx on public.withdrawal_requests (status, created_at);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions (user_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.notifications enable row level security;

revoke all on public.profiles, public.admins, public.deposit_requests,
  public.withdrawal_requests, public.wallet_transactions, public.notifications
  from public, anon, authenticated;

grant select on public.profiles, public.deposit_requests, public.withdrawal_requests,
  public.wallet_transactions, public.notifications to authenticated;
grant update (name, phone, country, bio) on public.profiles to authenticated;
grant update (read) on public.notifications to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "Users can update own profile details" on public.profiles;
create policy "Users can update own profile details" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users can read own deposits" on public.deposit_requests;
create policy "Users can read own deposits" on public.deposit_requests
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can read own withdrawals" on public.withdrawal_requests;
create policy "Users can read own withdrawals" on public.withdrawal_requests
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can read own transactions" on public.wallet_transactions;
create policy "Users can read own transactions" on public.wallet_transactions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

create or replace function public.add_notification(p_user_id uuid, p_icon text, p_text text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, icon, text)
  values (p_user_id, p_icon, p_text);
$$;

create or replace function public.request_withdrawal(
  p_amount bigint,
  p_account_name text,
  p_bank_name text,
  p_account_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in required.'; end if;
  if p_amount < 5000 then raise exception 'Minimum withdrawal is 5000.'; end if;
  if p_amount > 1000000000000 then raise exception 'Withdrawal amount is invalid.'; end if;
  if length(trim(coalesce(p_account_name, ''))) < 2
    or length(trim(coalesce(p_bank_name, ''))) < 2
    or trim(coalesce(p_account_number, '')) !~ '^[0-9]{10}$' then
    raise exception 'Enter a valid account name, bank name, and 10-digit account number.';
  end if;

  update public.profiles
  set balance = balance - p_amount
  where id = v_user_id and balance >= p_amount;
  if not found then raise exception 'Insufficient balance.'; end if;

  insert into public.withdrawal_requests
    (user_id, amount, account_name, bank_name, account_number)
  values
    (v_user_id, p_amount, trim(p_account_name), trim(p_bank_name), trim(p_account_number))
  returning id into v_request_id;

  insert into public.wallet_transactions
    (user_id, actor_id, transaction_type, amount, reference_id, reason)
  values (v_user_id, v_user_id, 'withdrawal_requested', -p_amount, v_request_id, 'Withdrawal submitted for approval');

  perform public.add_notification(v_user_id, 'fa-clock',
    'Your withdrawal request is awaiting admin approval.');
  return v_request_id;
end;
$$;

create or replace function public.request_deposit(
  p_plan text,
  p_quantity integer,
  p_receipt_name text,
  p_receipt_data text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_price bigint;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in required.'; end if;
  v_price := case p_plan
    when 'bronze' then 5000
    when 'silver' then 7000
    when 'platinum' then 10000
    when 'gold' then 15000
    else null
  end;
  if v_price is null then raise exception 'Select a valid plan.'; end if;
  if p_quantity < 1 or p_quantity > 20 then raise exception 'Quantity must be between 1 and 20.'; end if;
  if length(coalesce(p_receipt_data, '')) < 100 or length(p_receipt_data) > 7000000 then
    raise exception 'Receipt is missing or exceeds the allowed file size.';
  end if;
  if length(trim(coalesce(p_receipt_name, ''))) < 1 then raise exception 'Receipt filename is required.'; end if;

  insert into public.deposit_requests
    (user_id, plan, quantity, amount, receipt_name, receipt_data)
  values
    (v_user_id, p_plan, p_quantity, v_price * p_quantity, left(trim(p_receipt_name), 255), p_receipt_data)
  returning id into v_request_id;

  perform public.add_notification(v_user_id, 'fa-clock',
    'Your deposit receipt has been submitted for admin review.');
  return v_request_id;
end;
$$;

create or replace function public.admin_list_users()
returns table (user_id uuid, email text, name text, balance bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  return query
    select p.id, p.email, p.name, p.balance, p.created_at
    from public.profiles p order by p.created_at desc;
end;
$$;

create or replace function public.admin_list_withdrawals()
returns table (
  id uuid, user_id uuid, email text, name text, amount bigint,
  account_name text, bank_name text, account_number text, status text, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  return query
    select w.id, w.user_id, p.email, p.name, w.amount,
      w.account_name, w.bank_name, w.account_number, w.status, w.created_at
    from public.withdrawal_requests w
    join public.profiles p on p.id = w.user_id
    where w.status = 'pending'
    order by w.created_at;
end;
$$;

create or replace function public.admin_list_deposits()
returns table (
  id uuid, user_id uuid, email text, name text, plan text, quantity integer,
  amount bigint, receipt_name text, receipt_data text, status text, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  return query
    select d.id, d.user_id, p.email, p.name, d.plan, d.quantity, d.amount,
      d.receipt_name, d.receipt_data, d.status, d.created_at
    from public.deposit_requests d
    join public.profiles p on p.id = d.user_id
    where d.status = 'pending'
    order by d.created_at;
end;
$$;

create or replace function public.admin_credit_wallet(p_email text, p_amount bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if p_amount <= 0 or p_amount > 1000000000000 then raise exception 'Credit amount is invalid.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A reason is required.'; end if;

  select id into v_user_id from public.profiles where email = lower(trim(p_email)) for update;
  if v_user_id is null then raise exception 'User account not found.'; end if;
  update public.profiles set balance = balance + p_amount where id = v_user_id;
  insert into public.wallet_transactions (user_id, actor_id, transaction_type, amount, reason)
  values (v_user_id, auth.uid(), 'admin_credit', p_amount, trim(p_reason));
  perform public.add_notification(v_user_id, 'fa-wallet',
    'A wallet credit of ₦' || p_amount::text || ' has been applied. Reason: ' || trim(p_reason));
end;
$$;

create or replace function public.admin_mark_withdrawal_paid(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  update public.withdrawal_requests
  set status = 'paid', processed_at = now()
  where id = p_withdrawal_id and status = 'pending'
  returning * into v_request;
  if not found then raise exception 'Pending withdrawal request not found.'; end if;
  insert into public.wallet_transactions (user_id, actor_id, transaction_type, amount, reference_id, reason)
  values (v_request.user_id, auth.uid(), 'withdrawal_paid', 0, v_request.id, 'Admin marked withdrawal paid');
  perform public.add_notification(v_request.user_id, 'fa-circle-check',
    'Your withdrawal has been marked as paid by the admin.');
end;
$$;

create or replace function public.admin_reject_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  select * into v_request from public.withdrawal_requests
  where id = p_withdrawal_id and status = 'pending' for update;
  if not found then raise exception 'Pending withdrawal request not found.'; end if;
  update public.profiles set balance = balance + v_request.amount where id = v_request.user_id;
  update public.withdrawal_requests set status = 'rejected', processed_at = now() where id = v_request.id;
  insert into public.wallet_transactions (user_id, actor_id, transaction_type, amount, reference_id, reason)
  values (v_request.user_id, auth.uid(), 'withdrawal_refund', v_request.amount, v_request.id, 'Withdrawal rejected; held funds refunded');
  perform public.add_notification(v_request.user_id, 'fa-circle-exclamation',
    'Your withdrawal was rejected and the held funds have been returned to your wallet.');
end;
$$;

create or replace function public.admin_approve_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.deposit_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  select * into v_deposit from public.deposit_requests
  where id = p_deposit_id and status = 'pending' for update;
  if not found then raise exception 'Pending deposit request not found.'; end if;
  update public.profiles
  set balance = balance + v_deposit.amount,
      unlocked_plans = case when v_deposit.plan = any(unlocked_plans)
        then unlocked_plans else array_append(unlocked_plans, v_deposit.plan) end
  where id = v_deposit.user_id;
  update public.deposit_requests set status = 'approved', processed_at = now() where id = v_deposit.id;
  insert into public.wallet_transactions (user_id, actor_id, transaction_type, amount, reference_id, reason)
  values (v_deposit.user_id, auth.uid(), 'deposit_approved', v_deposit.amount, v_deposit.id,
    'Deposit receipt approved by admin');
  perform public.add_notification(v_deposit.user_id, 'fa-circle-check',
    'Your deposit of ₦' || v_deposit.amount::text || ' was approved and credited to your wallet.');
end;
$$;

create or replace function public.admin_reject_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.deposit_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  update public.deposit_requests
  set status = 'rejected', processed_at = now()
  where id = p_deposit_id and status = 'pending'
  returning * into v_deposit;
  if not found then raise exception 'Pending deposit request not found.'; end if;
  perform public.add_notification(v_deposit.user_id, 'fa-circle-exclamation',
    'Your deposit receipt was rejected. Please contact support if you need help.');
end;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke all on function public.create_profile_for_new_user(),
  public.is_admin(),
  public.add_notification(uuid, text, text),
  public.request_withdrawal(bigint, text, text, text),
  public.request_deposit(text, integer, text, text),
  public.admin_list_users(),
  public.admin_list_withdrawals(),
  public.admin_list_deposits(),
  public.admin_credit_wallet(text, bigint, text),
  public.admin_mark_withdrawal_paid(uuid),
  public.admin_reject_withdrawal(uuid),
  public.admin_approve_deposit(uuid),
  public.admin_reject_deposit(uuid)
from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
revoke execute on function public.request_withdrawal(bigint, text, text, text) from public, anon;
grant execute on function public.request_withdrawal(bigint, text, text, text) to authenticated;
revoke execute on function public.request_deposit(text, integer, text, text) from public, anon;
grant execute on function public.request_deposit(text, integer, text, text) to authenticated;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
revoke execute on function public.admin_list_withdrawals() from public, anon;
grant execute on function public.admin_list_withdrawals() to authenticated;
revoke execute on function public.admin_list_deposits() from public, anon;
grant execute on function public.admin_list_deposits() to authenticated;
revoke execute on function public.admin_credit_wallet(text, bigint, text) from public, anon;
grant execute on function public.admin_credit_wallet(text, bigint, text) to authenticated;
revoke execute on function public.admin_mark_withdrawal_paid(uuid) from public, anon;
grant execute on function public.admin_mark_withdrawal_paid(uuid) to authenticated;
revoke execute on function public.admin_reject_withdrawal(uuid) from public, anon;
grant execute on function public.admin_reject_withdrawal(uuid) to authenticated;
revoke execute on function public.admin_approve_deposit(uuid) from public, anon;
grant execute on function public.admin_approve_deposit(uuid) to authenticated;
revoke execute on function public.admin_reject_deposit(uuid) from public, anon;
grant execute on function public.admin_reject_deposit(uuid) to authenticated;
revoke execute on function public.add_notification(uuid, text, text) from public, anon, authenticated;

-- After the chosen admin registers and confirms their email, grant admin access
-- once from the Supabase SQL editor, replacing the email below:
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'admin@example.com';
