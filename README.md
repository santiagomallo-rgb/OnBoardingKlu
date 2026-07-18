# OnBoarding Klu

Software de gestión del onboarding de clientes, **multi-tenant por país**. Hoy implementa Argentina (SimplePay, según el Manual PLA/FT/FP v1.0 y el Manual de Onboarding KYC en `Research_Data/`) y México como segundo tenant de ejemplo.

## Ideas centrales

- **Onboarding por capas.** Cada producto se completa en etapas: la capa 1 son los datos mínimos para abrir la cuenta (los 11 datos de PH / 12 de PJ del Manual), la capa 2 amplía el perfil transaccional (más volumen), y se pueden agregar más capas por configuración. La interfaz le explica al cliente qué desbloquea cada etapa.
- **Los datos de una persona se cargan una sola vez.** Una persona (humana o jurídica) se identifica por país + identificación fiscal (`parties`). Si mañana pide otro producto, o aparece como beneficiario final de una empresa, sus datos se reutilizan.
- **Multi-tenant.** Cada país es un tenant con su propia configuración: tipo de identificación fiscal (CUIT con dígito verificador en AR, RFC en MX), formularios, chequeos de cumplimiento, productos y textos. Agregar un país = un archivo de configuración + una fila en la base.
- **Invitaciones seguras.** El admin da de alta un cliente y se envía un mail (Resend) con un link único. Quien abre el link **solo puede entrar si conoce la identificación fiscal** del invitado (5 intentos, expira a los 30 días).
- **Cumplimiento integrado.** Cada caso trae los chequeos internos del manual (REPET/OFAC/ONU 1267, Padrón BCRA A 8298, Sujeto Obligado UIF, revisión PEP), nivel de riesgo con su frecuencia de actualización de legajo (1/2/5 años), y cálculo del perfil transaccional (neto×13, 80% Monotributo, ventas brutas EEFF, perfiles predeterminados 12/74/120 SMVM).

## Estructura

```
app/                      # Next.js 16 (App Router) + Tailwind — deploy en Vercel
  src/config/tenants/     # ★ Configuración por país (ar.ts, mx.ts): capas, pasos,
                          #   campos, validación de tax id, chequeos, textos
  src/lib/                # Supabase (service role), sesiones HMAC, Resend, dominio
  src/app/admin/          # Panel interno (login por contraseña)
  src/app/o/[token]/      # Flujo público del cliente (gate + wizard + done)
  scripts/test-flow.ts    # Prueba end-to-end de la lógica contra la base
supabase/migrations/      # Esquema (tenants, parties, casos, capas, checks,
                          #   invites, documentos, eventos) + seed AR/MX
Research_Data/            # Manuales fuente (PLA/FT y Onboarding KYC)
```

**Base de datos:** Supabase (proyecto `oexzktdglmtjgbflujlb`, ya migrado y con seed). RLS activo denegando todo a `anon`: la app accede solo desde el servidor con la service role key. Documentos KYC en el bucket privado `kyc-docs`.

## Correr local

```bash
cd app
npm install
npm run dev        # http://localhost:3000
```

`app/.env.local` ya está creado con las keys reales de Supabase. Contraseña del panel: `ADMIN_PASSWORD` en ese archivo (por defecto `klu-admin-2026` — cambiala).

Hay dos casos demo cargados (María Demo y Demo Comercio SAS) para explorar el panel.

### E-mails (Resend)

Poné tu API key real en `RESEND_API_KEY` (empieza con `re_`). **Sin la key la app funciona igual**: la invitación se crea y el link se copia desde el detalle del caso. Ojo: con el remitente de prueba `onboarding@resend.dev`, Resend solo entrega a tu propio e-mail verificado; para producción verificá un dominio en Resend y cambiá `EMAIL_FROM`.

## Deploy en Vercel

La app vive en el subdirectorio `app/`, así que hay que decirle a Vercel dónde está.

1. **Importá el repo** en Vercel: New Project → elegí `santiagomallo-rgb/OnBoardingKlu`.
2. **Root Directory:** en la pantalla de import, abrí *Edit* y seteá **`app`** (esto es clave — sin esto Vercel no encuentra el Next). Framework: Next.js (se autodetecta).
3. **Variables de entorno** (Settings → Environment Variables). Copiá estas:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://oexzktdglmtjgbflujlb.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(Supabase → Settings → API → `service_role`, o copiala de tu `app/.env.local`)* |
   | `APP_SECRET` | generá uno nuevo: `openssl rand -hex 32` |
   | `ADMIN_PASSWORD` | la contraseña del panel que quieras |
   | `NEXT_PUBLIC_APP_URL` | la URL final, ej. `https://onboarding-klu.vercel.app` |
   | `RESEND_API_KEY` | tu key `re_...` (opcional; sin ella el link se copia del panel) |
   | `EMAIL_FROM` | `onboarding@resend.dev` (o tu dominio verificado en Resend) |

   > El `service_role` es **secreto**: cargalo solo en Vercel, nunca en el código ni en el repo.

4. **Deploy.** Primer deploy: al no saber aún la URL, podés dejar `NEXT_PUBLIC_APP_URL` vacío (los mails caen al dominio `*.vercel.app` automáticamente vía `VERCEL_URL`); cuando tengas el dominio final, seteala y redeployá para que los links de invitación queden perfectos.

La base de Supabase ya está migrada y con seed, así que la app queda operativa apenas termina el build. Si más adelante agregás migraciones, corré `supabase db push` desde tu máquina (no es parte del build de Vercel).

> **Nota sobre `Research_Data/`:** los manuales PLA/FT y de Onboarding están marcados "Confidencial" y **quedan fuera del repo** (`.gitignore` raíz). Su contenido ya está reflejado en la config. Si el repo es privado y querés versionarlos, borrá la línea `Research_Data/` del `.gitignore`.

## Cómo extender

- **Nuevo país:** crear `src/config/tenants/xx.ts` (copiando `mx.ts`), registrarlo en `src/config/index.ts` e insertar el tenant y sus productos en la tabla `tenants`/`products`.
- **Nuevo producto:** una fila en `products` (el flujo de identificación es el mismo; el Manual no distingue proceso por producto).
- **Nueva capa** (p. ej. debida diligencia reforzada): agregar un `LayerDef` en la config del tenant — el wizard, el progreso y el panel la levantan solos.
- **Flujos por SQL:** todas las migraciones van en `supabase/migrations/` y se aplican con `supabase db push`.

## Pendientes conocidos

- Los chequeos (REPET, A 8298, etc.) se marcan a mano en el panel; la integración automática con las fuentes queda para más adelante.
- Las personas vinculadas (apoderados, BF) quedan creadas con "legajo pendiente"; falta un flujo para invitarlas a completar sus propios 11 datos.
- Auth del panel es una contraseña única; para multiusuario conviene migrar a Supabase Auth.
- El tenant de México es una estructura de ejemplo: ajustar campos y chequeos al manual local cuando exista.
