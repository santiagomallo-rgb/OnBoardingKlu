-- OnBoarding Klu — esquema inicial multi-tenant
-- Toda la app accede por el servidor con service_role. RLS activo sin
-- políticas para anon/authenticated = denegado por defecto.

create extension if not exists pgcrypto;

-- ── Tenants (uno por país / entidad legal) ─────────────────────────────
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,            -- 'ar', 'mx'
  name        text not null,                   -- 'SimplePay Argentina'
  legal_name  text,
  country_code text not null,                  -- 'AR', 'MX'
  tax_id_type text not null,                   -- 'CUIT', 'RFC'
  locale      text not null default 'es-AR',
  currency    text not null default 'ARS',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Productos por tenant ───────────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text not null,                   -- 'pspcp', 'agregador'
  name        text not null,
  tagline     text,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, code)
);

-- ── Parties: persona humana o jurídica. Los datos se cargan UNA vez por
--    tenant+tax_id y quedan disponibles para todos los productos. ───────
create table if not exists parties (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kind         text not null check (kind in ('human','legal')),
  tax_id       text not null,                  -- CUIT/CUIL/CDI o RFC normalizado
  display_name text,
  email        text,
  phone        text,
  data         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, tax_id)
);

-- ── Vínculos entre parties (apoderados, representantes, BF, órgano adm.)
create table if not exists party_links (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  parent_party_id uuid not null references parties(id) on delete cascade,
  child_party_id  uuid not null references parties(id) on delete cascade,
  role            text not null,               -- 'apoderado','representante_legal','beneficiario_final','organo_administracion','autorizado','socio'
  ownership_pct   numeric,
  created_at      timestamptz not null default now(),
  unique (parent_party_id, child_party_id, role)
);

-- ── Casos de onboarding: una party pidiendo un producto ────────────────
create table if not exists onboarding_cases (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  party_id      uuid not null references parties(id) on delete cascade,
  product_id    uuid not null references products(id),
  status        text not null default 'invited'
                check (status in ('invited','in_progress','submitted','under_review','approved','rejected','blocked')),
  current_layer int not null default 1,
  risk_level    text check (risk_level in ('low','medium','high')),
  transactional_profile jsonb not null default '{}',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Progreso por capa dentro de un caso ────────────────────────────────
create table if not exists case_layers (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references onboarding_cases(id) on delete cascade,
  layer        int not null,
  status       text not null default 'pending'
               check (status in ('pending','in_progress','completed','approved')),
  data         jsonb not null default '{}',
  completed_at timestamptz,
  unique (case_id, layer)
);

-- ── Chequeos internos de cumplimiento (REPET/OFAC/ONU, A8298, UIF, PEP)
create table if not exists compliance_checks (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references onboarding_cases(id) on delete cascade,
  check_code   text not null,
  status       text not null default 'pending'
               check (status in ('pending','passed','flagged','blocked')),
  result_notes text,
  checked_by   text,
  checked_at   timestamptz,
  unique (case_id, check_code)
);

-- ── Invitaciones con token; el gate exige el tax id del cliente ────────
create table if not exists invites (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  case_id      uuid not null references onboarding_cases(id) on delete cascade,
  token        text unique not null,
  email        text not null,
  status       text not null default 'created'
               check (status in ('created','sent','opened','verified','expired','revoked')),
  attempts     int not null default 0,
  max_attempts int not null default 5,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  verified_at  timestamptz
);

-- ── Documentos subidos (metadata; binario en Storage bucket kyc-docs) ──
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  party_id     uuid not null references parties(id) on delete cascade,
  case_id      uuid references onboarding_cases(id) on delete set null,
  doc_type     text not null,                  -- 'estatuto','contrato_constitucion','recibo_sueldo',...
  file_name    text not null,
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);

-- ── Timeline de eventos por caso ───────────────────────────────────────
create table if not exists case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references onboarding_cases(id) on delete cascade,
  event      text not null,
  detail     jsonb not null default '{}',
  actor      text not null default 'system',   -- 'system' | 'admin' | 'client'
  created_at timestamptz not null default now()
);

create index if not exists idx_cases_tenant on onboarding_cases (tenant_id, status);
create index if not exists idx_parties_tenant_taxid on parties (tenant_id, tax_id);
create index if not exists idx_invites_token on invites (token);
create index if not exists idx_events_case on case_events (case_id, created_at);

-- RLS: denegar todo a anon/authenticated (el server usa service_role)
alter table tenants           enable row level security;
alter table products          enable row level security;
alter table parties           enable row level security;
alter table party_links       enable row level security;
alter table onboarding_cases  enable row level security;
alter table case_layers       enable row level security;
alter table compliance_checks enable row level security;
alter table invites           enable row level security;
alter table documents         enable row level security;
alter table case_events       enable row level security;

-- Bucket privado para documentación KYC
insert into storage.buckets (id, name, public)
values ('kyc-docs', 'kyc-docs', false)
on conflict (id) do nothing;

-- ── Seed: tenants y productos ──────────────────────────────────────────
insert into tenants (slug, name, legal_name, country_code, tax_id_type, locale, currency) values
  ('ar', 'SimplePay Argentina', 'Simple Payments SAS · Reg. BCRA N° 34.663', 'AR', 'CUIT', 'es-AR', 'ARS'),
  ('mx', 'Klu México', 'Klu México', 'MX', 'RFC', 'es-MX', 'MXN')
on conflict (slug) do nothing;

insert into products (tenant_id, code, name, tagline, description)
select t.id, p.code, p.name, p.tagline, p.description
from tenants t
join (values
  ('ar', 'pspcp',     'Cuenta de Pago (PSPCP)',      'Tu cuenta de pago para cobrar y pagar',
   'Cuenta de pago como Proveedor de Servicios de Pago que ofrece Cuentas de Pago. Recibí y enviá dinero, con CVU propio.'),
  ('ar', 'agregador', 'Agregador / Adquirente',      'Aceptá tarjetas en tu comercio',
   'Adherí tu comercio y aceptá pagos con tarjeta como Comercio Adherido de SimplePay.'),
  ('mx', 'cuenta',    'Cuenta Klu',                  'Tu cuenta para cobrar y pagar en México',
   'Cuenta de fondos de pago electrónico para personas y empresas.'),
  ('mx', 'adquirencia','Adquirencia Klu',            'Acepta pagos con tarjeta en tu negocio',
   'Afiliación de comercios para aceptación de pagos con tarjeta.')
) as p(tenant_slug, code, name, tagline, description) on p.tenant_slug = t.slug
on conflict (tenant_id, code) do nothing;
