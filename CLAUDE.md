# CLAUDE.md

## ⚠️ Regla principal: NO TOCAR GIT

**Nunca ejecutes comandos de git** (commit, add, push, pull, branch, checkout, reset, stash, merge, rebase, tag, status, diff, log...), salvo que el usuario pida explícitamente ese comando concreto. Git lo gestiona exclusivamente el usuario. Si hace falta verificar algo con git, dile al usuario qué comando ejecutar.

## Uso de modelos y tokens

El objetivo es no gastar tokens a lo tonto. El modelo de la sesión principal lo elige el usuario con `/model`; Claude solo elige el modelo de los subagentes.

- **Haiku** (subagente) para tareas mecánicas: buscar en el repo, renombrar, generar código repetitivo, formatear, traducir textos.
- **Sonnet** (subagente o sesión) para implementar funcionalidades ya definidas, tests y bugs normales.
- **Opus** para arquitectura, cifrado y seguridad, el diseño del esquema de Supabase y bugs difíciles.
- Antes de una tarea grande, avisar al usuario si conviene cambiar de modelo con `/model`. Por ejemplo, planificar con Opus y bajar a Sonnet para implementar.
- Usar subagentes solo cuando la tarea compense que arranquen sin contexto. Las tareas pequeñas se hacen directamente.
- Ser conciso: no releer ficheros sin necesidad ni repetir contexto.

## MCPs

- **Context7** (configurado en `.mcp.json`): documentación actualizada de librerías. Úsalo antes de escribir código con librerías externas (Supabase, React, Vite, SwiftUI, Netlify...) para no basarte en APIs desfasadas.
- La API key va en la variable de entorno `CONTEXT7_API_KEY` del shell del usuario. **Nunca** se escribe en ningún fichero del repo, porque el repo es público.
- **Supabase** (configurado en `.mcp.json`, proyecto `ddwzeemjdvvttnmdmded`): base de datos, migraciones, Edge Functions, logs y documentación. Se autentica con OAuth mediante `/mcp`, sin tokens en el repo. Usarlo junto con las skills `supabase` y `supabase-postgres-best-practices`. Antes de cualquier cambio destructivo en la base de datos (DROP, DELETE, migraciones que borran datos), pedir confirmación al usuario.

- **Netlify** (oficial, remoto, OAuth con `/mcp`): crear y configurar los sitios `balance` y `getbalance`, desplegar y gestionar variables de entorno.
- **Playwright** (Microsoft): abrir la PWA en un navegador, probar flujos y hacer capturas.
- **Sin MCP de Xcode** (descartado). `xcode-select` apunta a las CommandLineTools, así que para compilar desde la terminal hay que usar `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild ...`.
- `CLAUDE.md`, `.mcp.json`, `.claude/skills/` y `skills-lock.json` están en `.gitignore`: estas instrucciones y la configuración de MCPs y skills son locales y no se suben al repo público.

## Producto

Balance es una app de finanzas personales: ver cuánto tienes, en qué lo gastas y ahorrar para metas. Pilares:

1. **Control del dinero:** varias cuentas, saldo total, movimientos, gastos fijos e ingresos.
2. **Metas de ahorro:** objetivo, importe y plazo; la app calcula el ahorro mensual necesario.
3. **Asistente IA:** chat limitado a finanzas y a los datos del usuario.
4. **Registro sin esfuerzo:** lectura de tickets/facturas/capturas con IA y Atajo de iPhone que envía cada pago.

Fase actual: **definición**. Las pantallas aún no están definidas.

## Decisiones tomadas

- **Plataformas:** app iOS nativa en SwiftUI (`apps/ios/balance`) y app web PWA en React + Vite + TypeScript (`apps/web`, prevista). Deben ser **idénticas**. Sin versión de escritorio.
- **Backend:** Supabase (auth, base de datos, Edge Functions).
- **Hosting:** Netlify, con dos sitios: `balance` (app web) y `getbalance` (landing).
- **Cifrado en servidor:** todos los datos del usuario se guardan cifrados excepto nombre, nombre de usuario y correo. La clave vive en Supabase Vault o en los secretos de las Edge Functions y nunca llega al cliente. Solo las Edge Functions descifran, en el momento de usar los datos (IA, Atajo).
- **Entrada de datos:** manual, Atajo de iPhone (automatización "Transacción" de Wallet que hace POST a una Edge Function con un token por usuario) y lectura de tickets con IA. **Sin sincronización bancaria.**
- **Asistente:** las preguntas fijas y frecuentes se resuelven con lógica determinista, sin IA. La IA se usa solo para preguntas libres y lectura de tickets.
- **Acceso:** PIN de 4 dígitos opcional. En iOS, Face ID opcional y solo si hay PIN.
- **Moneda e idioma:** solo EUR y solo español.

## Restricciones

- **Sin Apple Developer Program:** la app iOS es solo para el usuario. No hay distribución ni APNs (no hay push remotas en iOS nativo) y la firma gratuita caduca a los 7 días.
- **Paridad total iOS–web:** cualquier funcionalidad o cambio de diseño se aplica en ambas.
- **Nunca guardar datos del usuario en claro**, salvo los tres campos permitidos.
- **Claves de IA y de cifrado:** solo en el servidor, nunca en el cliente.

## Por decidir

- Proveedor de IA. Dejar una capa de abstracción en la Edge Function.
- Notificaciones (OneSignal, avisos de pagos fijos): fuera del alcance por ahora.
- Stack de la landing (con una moneda en el hero que sigue al usuario al hacer scroll).
- Pantallas y su contenido.

## Forma de trabajar

- Toda la interfaz va en español.
- Preguntar antes de proponer pantallas o funcionalidades que no estén definidas.
- No introducir servicios o dependencias de pago sin consultarlo.

## Estructura del repo

```
apps/
  ios/balance/     # Proyecto Xcode: abrir apps/ios/balance/balance.xcodeproj
  web/             # PWA React + Vite + TS (prevista)
  landing/         # Landing (prevista, stack por decidir)
supabase/          # Migraciones y Edge Functions (previsto)
```
