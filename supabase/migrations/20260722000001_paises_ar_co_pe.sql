-- Operación en Argentina, Colombia y Perú. Los tenants se muestran con el
-- nombre del país a secas; la entidad legal sigue viviendo en legal_name.

-- Nombres = país
update tenants set name = 'Argentina' where slug = 'ar';
update tenants set name = 'Colombia',  flag = '🇨🇴' where slug = 'co';

-- México sale de la operación (arrastra sus productos por cascada)
delete from tenants where slug = 'mx';

-- Perú entra vacío: sus productos y requisitos se cargan desde el panel
insert into tenants (
  slug, name, country_code, tax_id_type, tax_id_label,
  tax_id_placeholder, tax_id_help, flag, locale, currency, active
) values (
  'pe', 'Perú', 'PE', 'RUC', 'RUC / DNI',
  '20123456789', 'Ingresá tu RUC (11 dígitos) o tu DNI (8 dígitos).',
  '🇵🇪', 'es-PE', 'PEN', true
)
on conflict (slug) do update set
  name = excluded.name,
  tax_id_label = excluded.tax_id_label,
  flag = excluded.flag;
