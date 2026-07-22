-- Configuración editable desde la UI (PRD §7.1: la normativa se expresa como
-- datos, no como código).
--
-- 1) tenants gana las columnas que hasta ahora vivían hardcodeadas en
--    src/config/tenants/*.ts, para que un país creado desde el panel sea
--    autosuficiente.
-- 2) product_requirements: los campos/documentos/controles que hay que cumplir
--    por cumplimiento para cada producto. Se cargan desde el panel.

-- ── 1. Config del país en la base ────────────────────────────────────────
alter table tenants
  add column if not exists tax_id_label       text,
  add column if not exists tax_id_placeholder text,
  add column if not exists tax_id_help        text,
  add column if not exists flag               text,          -- emoji de bandera
  add column if not exists welcome_title      text,
  add column if not exists welcome_body       text;

-- Backfill de los dos países que ya existían
update tenants set
  tax_id_label       = coalesce(tax_id_label, 'CUIT / CUIL / CDI'),
  tax_id_placeholder = coalesce(tax_id_placeholder, '20-12345678-9'),
  tax_id_help        = coalesce(tax_id_help, 'Ingresá tu CUIT, CUIL o CDI, con o sin guiones.'),
  flag               = coalesce(flag, '🇦🇷')
where slug = 'ar';

update tenants set
  tax_id_label       = coalesce(tax_id_label, 'RFC'),
  tax_id_placeholder = coalesce(tax_id_placeholder, 'XAXX010101000'),
  tax_id_help        = coalesce(tax_id_help, 'Ingresá tu RFC con homoclave.'),
  flag               = coalesce(flag, '🇲🇽')
where slug = 'mx';

-- Cualquier otro país sin config: valores neutros para que nunca quede en null
update tenants set
  tax_id_label       = coalesce(tax_id_label, tax_id_type),
  tax_id_placeholder = coalesce(tax_id_placeholder, ''),
  tax_id_help        = coalesce(tax_id_help, 'Ingresá tu identificación fiscal.'),
  flag               = coalesce(flag, '🌎');

-- ── 2. Requisitos de cumplimiento por producto ───────────────────────────
create table if not exists product_requirements (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,

  code        text not null,                    -- clave del campo: 'domicilio_real'
  label       text not null,                    -- lo que ve el cliente
  help        text,                             -- por qué se pide

  -- Qué clase de requisito es (PRD §A.3/§A.6)
  category    text not null default 'dato'
              check (category in ('dato', 'documento', 'declaracion', 'control')),

  -- Cómo se captura (mapea a FieldDef.type del wizard)
  field_type  text not null default 'text'
              check (field_type in ('text','date','select','email','phone',
                                    'number','textarea','boolean','people','file')),

  -- A qué tipo de cliente aplica
  applies_to  text not null default 'both'
              check (applies_to in ('human', 'legal', 'both')),

  required    boolean not null default true,
  options     jsonb   not null default '[]',    -- para field_type='select'
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now(),

  unique (product_id, code)
);

create index if not exists product_requirements_product_idx
  on product_requirements (product_id, sort_order);

alter table product_requirements enable row level security;
-- Sin políticas: sólo el service role (backend) accede. anon/authenticated quedan negados.
