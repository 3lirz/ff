create extension if not exists pgcrypto;

create table if not exists public.vexa_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null,
  ip_hash text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts >= 0),
  verified_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists vexa_otp_phone_created_idx
  on public.vexa_otp_challenges (phone_hash, created_at desc);

create index if not exists vexa_otp_ip_created_idx
  on public.vexa_otp_challenges (ip_hash, created_at desc);

create index if not exists vexa_otp_expires_idx
  on public.vexa_otp_challenges (expires_at);

alter table public.vexa_otp_challenges enable row level security;
revoke all on table public.vexa_otp_challenges from anon, authenticated;
grant all on table public.vexa_otp_challenges to service_role;

comment on table public.vexa_otp_challenges is 'Private VEXA OTP challenges. Access only from trusted backend with Supabase secret/server key.';
