# Kuepa CRM · Registro de leads

Prueba técnica Full Stack para Kuepa EduTech. Sobre la plantilla del CRM (login ya funcional) se implementó el **registro de prospectos (leads)** interesados en los programas académicos: modelo de datos, API y formulario.

- **Front:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui + nanostores + i18next
- **Back:** Node 18 + Express + TypeScript + Mongoose 7
- **Base de datos:** MongoDB

## Qué se implementó

- `POST /api/lead/create`: registra un lead validando y normalizando los datos, deduplicando el contacto y asignando el asesor.
- `GET /api/lead/check-contact`: avisa en vivo si el contacto ya existe o ya tiene un lead abierto.
- `GET /api/program` y `programSeeder`: catálogo de programas académicos para el campo "programa de interés".
- Página `/leads`, organizada así:
  - Formulario en tres secciones (datos personales, contacto y programa de interés).
  - Programas como tarjetas seleccionables.
  - Validación en el cliente igual a la del back y aviso de contacto existente.
  - Panel de leads recientes.
  - Textos en español e inglés, y animaciones que respetan `prefers-reduced-motion`.
- Corrección de los problemas de la plantilla que impedían que el módulo de leads funcionara (ver más abajo).
- Pruebas de la validación (`node:test`), CI con GitHub Actions y `docker-compose` con Mongo.

## Cómo levantarlo

**Requisitos:** Node 18 o superior, npm y MongoDB 6 o superior (local o con Docker).

```bash
# 1. MongoDB (opcional si ya tienes uno local en 27017)
docker compose up -d

# 2. Back
cd back
cp .env.example .env          # ajusta MONGO_URI / JWT_SECRET si hace falta
npm i
npm run cli -- --seeder initSeeder -f      # usuario, rol, asesor y programas
npm run dev                                # http://localhost:7001

# 3. Front (otra terminal)
cd front
npm i
npm run dev                                # http://localhost:5173
```

`initSeeder` deja todo listo con el comando que indica la prueba: crea el usuario, el rol `Asesor` con los permisos del CRM (`sidebar:crm`, `sidebar:leads`, `crm:leads`), el `Third` del asesor asociado al usuario y el catálogo de programas, que delega en `programSeeder`. Es idempotente, así que se puede correr varias veces con `-f`. `programSeeder` también se puede ejecutar por separado.

**Credenciales de prueba** (las crea `initSeeder`):

| Usuario | Contraseña |
|---|---|
| `useradminket` | `ket#2025` |

Después de iniciar sesión, entra a **CRM → Contactos** en el sidebar, o directamente a **`/leads`**.

**Variables de entorno del back** (`back/.env`). Todas tienen como respaldo el valor que tenía la plantilla, así que el proyecto funciona sin `.env`:

| Variable | Default |
|---|---|
| `PORT` | `7001` |
| `PUBLIC_URL` | `http://localhost:7001` |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/kuepa_test…` |
| `JWT_SECRET` | secreto de la plantilla |

**Scripts útiles**

| Dónde | Comando | Qué hace |
|---|---|---|
| back | `npm run typecheck` | Verificación de tipos con `tsc` |
| back | `npm test` | Pruebas de normalización y validación de leads |
| front | `npm run build` | Verificación de tipos y build de producción |

## Análisis del modelo de datos y decisiones

### La persona vive en `Third`; el `Lead` es el proceso comercial

La plantilla ya separa dos conceptos, aunque el `LeadSchema` no lo reflejaba:

- **`Third`** es la persona o entidad. Tiene `first_name`, `last_name`, `document_type` (`cc | ti | pp | nt`), `document`, `email`, `number` y `type` (`cli` para cliente o prospecto, `emp` para empleado o asesor, `sup` para proveedor). Los usuarios del sistema se enlazan a un `Third` por `user`.
- **`Lead`** es la oportunidad comercial: qué programa le interesa a la persona, quién la atiende, de qué campaña viene, en qué estado está y su historial de seguimientos.

`leadService` ya trataba al lead así: `external` crea un `Third` con `type: 'cli'` y luego un lead con `contact`; `list` hace `populate('contact')` y arma `full_name` desde el contacto; `adviserInfo` filtra por `campaign` y `contact`. En cambio, el `LeadSchema` duplicaba los datos de la persona y no tenía esas referencias. Por eso se rediseñó el modelo:

```text
Lead
├─ incremental      Number, único (4 dígitos, empieza en 1000)
├─ contact          → Third (cli)        required
├─ adviser          → Third (asesor)
├─ interestProgram  → Program            required
├─ campaign         → Campaign
├─ adnetwork        → Adnetwork
├─ source           web | manual | referral | event | social   (default manual)
├─ notes            String
├─ status           active | grading | sold | dropped | inactive (default active)
└─ trackings[]      { tracking → Tracking, description, interest, created_at }
```

Índices en `contact`, `adviser` y `status`, que son los filtros que usa el servicio.

Con este diseño, una persona puede tener varios leads a lo largo del tiempo (por ejemplo, termina el bachillerato y luego se interesa por un técnico) sin duplicar sus datos. Además, el resto de módulos de la plantilla (interacciones y mensajes) ya apuntan a `Third`.

### Deduplicación de contactos

Al registrar un lead se busca un `Third` con `type: 'cli'` que coincida en **documento, correo o celular**:

- Si existe, se reutiliza y solo se completan los datos que tenga vacíos. Nunca se sobrescribe información ya registrada.
- Si no existe, se crea con `status: 'active'`.

Antes de comparar se normalizan los datos: `trim`, correo en minúsculas, celular solo con dígitos (se quita el `+57`) y documento sin puntos ni espacios. Así `1.020.304` y `1020304` son el mismo documento.

### Un solo lead abierto por contacto

Si el contacto ya tiene un lead en estado `active` o `grading`, la API responde **409 `lead.already_exists`** e incluye el lead existente. Así se evita que dos asesores trabajen la misma persona en paralelo. Los leads cerrados (`sold`, `dropped`, `inactive`) no bloquean un registro nuevo. El formulario lo anticipa con el aviso de `check-contact` al salir de documento, correo o celular.

### Asignación de asesor

El asesor (`adviser`) es el `Third` asociado al usuario logueado (`Third.user = user._id`). La plantilla original creaba el usuario de prueba **sin** ese `Third`. Ahora `initSeeder` lo crea con `type: 'emp'`, pero el servicio sigue siendo tolerante: si un usuario no tiene `Third`, el lead se crea sin asesor en lugar de fallar, y `list` solo filtra por asesor cuando ese `Third` existe. La asignación balanceada por campaña queda como mejora futura; el `TODO: Balance` del servicio `external` ya la anticipa.

## Problemas encontrados en la plantilla y cómo se resolvieron

1. **Rutas de leads sin registrar.** `router/index.ts` no inicializaba `LeadRoute`, así que todo `/api/lead/*` respondía 404. Se registró respetando los marcadores `// @…` del CLI.
2. **El esquema no tenía los campos que usa el servicio.** A `LeadSchema` le faltaban `contact`, `adviser`, `campaign` y `adnetwork`, y Mongoose en modo strict los descartaba en silencio. Se agregaron como referencias.
3. **Estados incompletos.** El enum de `status` solo aceptaba `active | inactive`, pero el servicio usa `grading`, `sold` y `dropped`. Se amplió el enum. También se agregaron a `Tracking` los campos `target_status`, `defaults` y `status`, que el servicio ya leía.
4. **Datos de la persona duplicados.** El lead repetía nombre, correo y celular del `Third`. Se quitaron del lead y quedaron referenciados por `contact`.
5. **`Program` inaccesible.** No estaba exportado, no tenía endpoint ni seeder. Se exportó, se le agregó `status` y se crearon el dominio `program` y `programSeeder`, que es idempotente (upsert por nombre).
6. **El usuario logueado nunca llegaba al servicio.** `authMiddleware` lo deja en `user_logged`, pero el servicio leía `user`, así que nunca se asignaba ni se filtraba por asesor. El controller de leads ahora mapea `user_logged` a `user`.
7. **Problemas menores:**
   - `ILead` estaba mal tipado.
   - Los `catch` no retornaban respuesta y el request quedaba colgado; ahora devuelven `500`.
   - Typo `crated_at` en el `sort`.
   - Claves de error inexistentes: `third.not_found1/2`.
   - `errors.ts` estaba vacío, así que todos los errores salían con 500.
   - `responseUtility.success` ignora su argumento `code`; el `201` se envía dentro del objeto.
   - El sidebar apuntaba a `/crm/leads` en lugar de `/leads`.
   - URI de Mongo y JWT quemados en el código; ahora salen de `.env`.
   - `.env` no estaba en `.gitignore`.
   - `initSeeder` creaba el usuario con `roles: []`. El sidebar exige los permisos `sidebar:crm` y `crm:leads`, así que el módulo de leads no aparecía tras el login. Ahora el seeder crea el rol con esos permisos, el `Third` del asesor y los programas.
   - `attachmentUtility.ts` importa `@aws-sdk/*`, que no está instalado. No lo usa nadie y se excluyó del `typecheck`.

## Endpoints nuevos

Todos requieren el header `Authorization: <token>` que devuelve el login.

### `GET /api/program`

Lista los programas activos, ordenados por nombre.

```json
{
  "code": 200,
  "status": "success",
  "list": [
    { "_id": "66f…a1", "name": "Bachillerato Virtual", "description": "Termina tu bachillerato…" }
  ]
}
```

### `POST /api/lead/create`

```json
{
  "first_name": "Ana María",
  "last_name": "Pérez",
  "document_type": "cc",
  "document": "1020304050",
  "email": "ana@correo.com",
  "number": "3101234567",
  "interestProgram": "66f…a1",
  "source": "web",
  "notes": "Prefiere contacto en la tarde"
}
```

**201: lead creado**, con `contact` e `interestProgram` poblados:

```json
{
  "code": 201,
  "status": "success",
  "object": {
    "_id": "66f…b2",
    "incremental": 1000,
    "contact": { "_id": "66f…c3", "first_name": "Ana María", "last_name": "Pérez", "document_type": "cc", "document": "1020304050", "email": "ana@correo.com", "number": "3101234567" },
    "interestProgram": { "_id": "66f…a1", "name": "Bachillerato Virtual" },
    "source": "web",
    "status": "active",
    "notes": "Prefiere contacto en la tarde",
    "trackings": [],
    "created_at": "2026-10-01T15:00:00.000Z"
  }
}
```

**Respuestas de error**

| Código | `message` | Cuándo | Cuerpo adicional |
|---|---|---|---|
| 400 | `lead.invalid_params` | Algún campo no pasa la validación | `fields` con el error por campo (`required`, `invalid` o `too_long`), p. ej. `{ "email": "invalid", "number": "required" }` |
| 404 | `program.not_found` | El programa no existe o está inactivo | `fields: { "interestProgram": "not_found" }` |
| 409 | `lead.already_exists` | El contacto ya tiene un lead `active` o `grading` | `object` con el lead existente |

Reglas de validación (las mismas en el front y en el back):

- Nombres y apellidos: obligatorios, máximo 60 caracteres.
- Documento: de 5 a 12 dígitos, o alfanumérico si es pasaporte (`pp`).
- Correo con formato válido.
- Celular colombiano: 10 dígitos que empiezan por 3.
- `source` debe ser uno de los valores del enum.
- `notes`: máximo 500 caracteres.

### `GET /api/lead/check-contact?document=&email=&number=`

```json
{
  "code": 200,
  "status": "success",
  "exists": true,
  "contact": { "_id": "66f…c3", "first_name": "Ana María", "last_name": "Pérez" },
  "matches": ["email"],
  "lead": { "_id": "66f…b2", "incremental": 1000, "status": "active", "interestProgram": { "name": "Bachillerato Virtual" } }
}
```

Si no hay coincidencia responde `{ "exists": false }`, y `lead` es `null` cuando el contacto no tiene un lead abierto.

### `GET /api/lead` (actualizado)

Devuelve los últimos 100 leads con `contact` e `interestProgram` poblados y `full_name` calculado. Si el usuario logueado tiene un `Third` asociado, solo muestra sus leads.

## Flujo de trabajo

- Ramas por feature: `feat/back-leads`, `feat/front-leads-form`, `chore/ci-tests` y `docs/readme`. Cada una se integra a `main` con `merge --no-ff`, para que el historial muestre cada bloque.
- Commits atómicos con Conventional Commits en español.
- **CI** (`.github/workflows/ci.yml`): en cada push a `main` y en cada PR corre el typecheck y las pruebas del back, y el build del front (Node 18, con caché de npm). El `dist` del front queda como artefacto del workflow.

## Mejoras futuras

- **Pruebas de integración** de `leadService` contra un Mongo en memoria o en un contenedor de CI, y pruebas de componentes del formulario.
- **Paginación y filtros** en el listado (estado, programa, asesor, fechas) y búsqueda por nombre o documento.
- **Edición y detalle del lead**: cambio de estado y reasignación de asesor.
- **Trackings**: registrar seguimientos desde la UI, con transiciones de estado según `target_status`.
- **Asignación balanceada de asesores por campaña** (round-robin o según carga), y crear el `Third` del asesor al crear el usuario.
- **Unicidad en base de datos**: índices únicos parciales en `Third` (`type: 'cli'` + documento o correo) para cerrar las condiciones de carrera de la deduplicación, y un contador atómico para `incremental`.
- **i18n de los errores del back** y un catálogo de errores tipado compartido con el front.
