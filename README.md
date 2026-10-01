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
  - Acento en el naranja de la marca Kuepa. Se evita el negro como acento por legibilidad, y todas las combinaciones cumplen el contraste AA.
- **Edición y borrado de leads** desde la tabla. La edición abre un panel lateral que reutiliza el mismo formulario y la misma validación, e incluye el cambio de estado. El borrado es lógico y pide confirmación.
- **Análisis de factibilidad** (`POST /api/lead/score/:_id`): un score de 0 a 100 de la probabilidad de matrícula, con factores explicables y una siguiente acción recomendada. Si se configura `OPENAI_API_KEY`, se suma un análisis redactado por OpenAI.
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
| `OPENAI_API_KEY` | vacío: el análisis de factibilidad usa solo reglas |
| `OPENAI_MODEL` | `gpt-4o-mini` |

**Scripts útiles**

| Dónde | Comando | Qué hace |
|---|---|---|
| back | `npm run typecheck` | Verificación de tipos con `tsc` |
| back | `npm test` | Pruebas de validación y del score de factibilidad |
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

### Edición y borrado

- **Editar** actualiza dos cosas. Los datos personales se guardan en el `Third`, porque son de la persona, y aplican a todos sus leads. Programa, origen, notas y estado se guardan en el `Lead`. Se valida que el nuevo documento, correo o celular no pertenezca a otro contacto (409 `third.already_exists`). Tampoco se permite reabrir un lead (`active`/`grading`) si el contacto ya tiene otro abierto.
- **Borrar** es un borrado lógico con `mongoose-delete`, que el modelo ya traía configurado: el lead deja de aparecer, pero se conserva para auditoría. El `Third` **no** se borra, porque puede tener otros leads o interacciones. Un lead borrado tampoco bloquea registrar un lead nuevo para esa persona.
- Las mutaciones usan `POST` (`/update/:_id`, `/delete/:_id`) para seguir la convención de la plantilla (`/upsert`, `/ghost`) y el helper `post` del front.

### Análisis de factibilidad (reglas + OpenAI)

El objetivo es ayudar al asesor a priorizar: a qué lead llamar primero y qué hacer con cada uno.

1. **Score por reglas** (`leadScoring.ts`). Es determinístico, está probado y no depende de servicios externos. Suma seis factores:

   | Factor | Puntos máximos | Criterio |
   |---|---|---|
   | Origen | 25 | Referido 25, evento 20, web 18, redes 12, manual 10 |
   | Canales de contacto | 20 | Documento, correo y celular disponibles |
   | Notas | 15 | Notas con contexto (40 caracteres o más) suman más que notas cortas |
   | Recencia | 20 | Un lead de 2 días o menos vale más que uno de más de un mes |
   | Historial | 10 | El contacto ya había mostrado interés antes |
   | Estado | 10 | Más puntos si está en calificación (`grading`) que si está solo activo |

   Niveles: **alta** desde 70 puntos, **media** desde 45 y **baja** por debajo. Un lead `sold` vale 100 y uno `dropped` o `inactive` no pasa de 20.
2. **OpenAI (opcional)**. Si existe `OPENAI_API_KEY`, `openaiUtility` llama a Chat Completions con `fetch` nativo (sin SDK nuevo), en modo JSON y con timeout. Los prompts viven en `resources/prompts/` (`system.ts` e `inference.ts`), que la plantilla ya tenía preparados y vacíos. El modelo recibe el score por reglas como referencia y **solo puede moverlo ±20 puntos**, lo que mantiene el resultado predecible. Además redacta el resumen, las fortalezas, los riesgos y la siguiente acción.
3. **Privacidad**: a OpenAI **no** se envían nombre, documento, correo ni celular. Solo viajan el programa, el origen, el estado, la antigüedad, si existe cada canal (sí/no), las notas y el historial.
4. **Tolerancia a fallos**: si no hay key, la API falla o se agota el tiempo, la respuesta usa solo las reglas. El resultado se guarda en `lead.scoring` y la tabla lo muestra como un chip de color.

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

### `POST /api/lead/update/:_id`

El body es el mismo que el de `create`, más `status`. Responde **200** con el lead actualizado y poblado.

**Respuestas de error**

| Código | `message` | Cuándo |
|---|---|---|
| 400 | `lead.invalid_params` | Algún campo no es válido |
| 404 | `lead.not_found` | El lead no existe |
| 404 | `program.not_found` | El programa no existe |
| 409 | `third.already_exists` | El nuevo documento, correo o celular es de otro contacto. Incluye `fields`, p. ej. `{ "email": "already_exists" }` |
| 409 | `lead.already_exists` | Se intenta reabrir el lead y el contacto ya tiene otro abierto |

### `POST /api/lead/delete/:_id`

Hace borrado lógico. Responde `{ "code": 200, "deleted": true }`, o 404 si el lead no existe.

### `POST /api/lead/score/:_id`

```json
{
  "code": 200,
  "status": "success",
  "object": {
    "score": 80,
    "level": "high",
    "engine": "rules",
    "rule_score": 80,
    "factors": [
      { "key": "source", "points": 20, "max": 25 },
      { "key": "channels", "points": 20, "max": 20 },
      { "key": "notes", "points": 15, "max": 15 },
      { "key": "recency", "points": 20, "max": 20 },
      { "key": "history", "points": 0, "max": 10 },
      { "key": "status", "points": 5, "max": 10 }
    ],
    "next_action_key": "call_today",
    "evaluated_at": "2026-10-01T15:00:00.000Z"
  }
}
```

Con OpenAI, `engine` es `"openai"` y la respuesta incluye además `model`, `summary`, `strengths`, `risks` y `next_action`, este último redactado por el modelo.

### `GET /api/lead` (actualizado)

Devuelve los últimos 100 leads con `contact` e `interestProgram` poblados y `full_name` calculado. Si el usuario logueado tiene un `Third` asociado, solo muestra sus leads.

## Flujo de trabajo

- Ramas por feature: `feat/back-leads`, `feat/front-leads-form`, `chore/ci-tests`, `docs/readme`, `feat/seeder-acceso-crm`, `feat/lead-edicion`, `feat/lead-scoring` y `style/acento-naranja-kuepa`. Cada una se integra a `main` con `merge --no-ff`, para que el historial muestre cada bloque.
- Commits atómicos con Conventional Commits en español.
- **CI** (`.github/workflows/ci.yml`): en cada push a `main` y en cada PR corre el typecheck y las pruebas del back, y el build del front (Node 18, con caché de npm). El `dist` del front queda como artefacto del workflow.

## Mejoras futuras

- **Dashboard del CRM** en `/crm`, la ruta del grupo "crm" del sidebar, que hoy no tiene página. Mostraría KPIs (leads abiertos, tasa de matrícula, score promedio, nuevos en la semana), el embudo por estado, la distribución por origen y por programa, y los registros por día. Todo con agregaciones de Mongo sobre `Lead`, sin modelos nuevos.
- **Cola "A quién contactar"** con recomendaciones para el asesor:
  - *Leads para llamar hoy*: leads abiertos ordenados por el score de reglas, que no consume OpenAI, con el motivo, la siguiente acción y accesos directos a llamada y WhatsApp.
  - *Contactos para reactivar*: personas en `Third` sin lead abierto cuyo último lead se descartó, quedó inactivo o terminó en matrícula. En este último caso se les ofrecería otro programa. Desde ahí se crearía el lead con el formulario precargado, y la deduplicación ya existente reutiliza el contacto.
- **Seeder de datos demo** para poblar el dashboard con contactos y leads realistas distribuidos en el tiempo.
- **Pruebas de integración** de `leadService` contra un Mongo en memoria o en un contenedor de CI, y pruebas de componentes del formulario.
- **Paginación y filtros** en el listado (estado, programa, asesor, fechas) y búsqueda por nombre o documento.
- **Reasignación de asesor** desde la edición, y una vista de detalle con el historial de interacciones.
- **Calibrar el score** con datos reales de conversión por origen y programa, y recalcularlo automáticamente al cambiar el estado o al registrar un seguimiento.
- **Trackings**: registrar seguimientos desde la UI, con transiciones de estado según `target_status`.
- **Asignación balanceada de asesores por campaña** (round-robin o según carga), y crear el `Third` del asesor al crear el usuario.
- **Unicidad en base de datos**: índices únicos parciales en `Third` (`type: 'cli'` + documento o correo) para cerrar las condiciones de carrera de la deduplicación, y un contador atómico para `incremental`.
- **i18n de los errores del back** y un catálogo de errores tipado compartido con el front.
