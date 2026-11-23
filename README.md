# Balance

App para controlar tu dinero de forma sencilla: ver cuánto tienes, en qué lo gastas y ahorrar para tus metas (un coche, una casa, un viaje, una PS5...). Balance no solo registra: te ayuda activamente a cumplir esas metas.

## Pilares

1. **Control del dinero:** saldo total entre varias cuentas, movimientos, gastos fijos e ingresos.
2. **Metas de ahorro:** defines objetivo, importe y plazo, y la app calcula cuánto apartar cada mes.
3. **Asistente IA:** chat limitado a finanzas y a tus datos ("¿cuánto gasté en comida este mes?"). Las preguntas frecuentes se resuelven con lógica normal; la IA solo entra en preguntas libres.
4. **Registro de pagos sin esfuerzo:**
   - Lectura de tickets, facturas y capturas de pago con IA para crear el movimiento.
   - Atajo de iPhone (Shortcuts) que detecta cada pago y lo envía a Balance automáticamente.

## Plataformas

- **App iOS** nativa.
- **App web**, instalable como PWA.

Ambas versiones son idénticas en funcionalidad y diseño.

## Stack

- **Supabase:** autenticación, base de datos y Edge Functions.
- **React + Vite + TypeScript:** app web.
- **SwiftUI:** app iOS.
- **Netlify:** hosting.

## Privacidad

Todos los datos del usuario se guardan cifrados, excepto nombre, nombre de usuario y correo. Acceso opcional con PIN de 4 dígitos y, en iOS, Face ID (solo si hay PIN).

## Estructura

```
apps/
  ios/balance/     # App iOS (SwiftUI): abrir balance.xcodeproj
```
