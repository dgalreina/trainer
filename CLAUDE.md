# Trainer

App personal para registrar la evolución en el gym, con IA que guía al usuario.
Primero PWA para uso propio; después App Store (iPhone). Si funciona, se podría monetizar.

## Estructura (monorepo con npm workspaces)

- `apps/mobile`: Expo + React Native + TypeScript + Expo Router. Se prueba como PWA (`expo start --web`) y más adelante como app iOS.
- `apps/api`: backend Node + TypeScript con NestJS (ESM). Se despliega en AWS Lambda + API Gateway (región UE). `src/main.ts` es el servidor local; `src/lambda.ts` es el handler de Lambda.
- `packages/shared`: tipos y validaciones compartidos (contrato de la API).

## Decisiones tomadas

- **Frontend estático:** `expo export --platform web` con `output: "static"`. Se publica en GitHub Pages u hosting estático. Si va en una subruta, configurar `experiments.baseUrl`.
- **Los datos viven en el backend** (MongoDB Atlas), nunca solo en el dispositivo: Safari puede borrar el almacenamiento local de una PWA.
- **La API key de Anthropic solo en el backend.** Nunca en el cliente.
- **IA con Claude** (Sonnet para análisis comparativos y de fotos, Haiku si basta). Aislar el proveedor tras funciones propias, por ejemplo `analyzeProgress(photos)`.
- **Control de coste:** guardar `userId` y tokens consumidos en cada llamada a la IA; `max_tokens` limitado; contexto mínimo (resúmenes, no historial completo); límite de gasto mensual en la consola de Anthropic y alerta de facturación en AWS Budgets.
- **Lo específico de iOS** (pasos y energía activa de HealthKit, suscripciones con RevenueCat) va detrás de una capa propia (`getSteps()`, etc.). En web devuelve vacío o entrada manual.
- **Dieta:** el cálculo de calorías y macros lo hace el código (Mifflin-St Jeor, energía activa), no la IA. La IA solo explica y adapta. Topes duros en código: sin déficits agresivos ni calorías por debajo de un mínimo seguro.
- **Fotos de progreso:** la IA habla de indicios y tendencias, sin juicios estéticos. Consentimiento explícito, almacenamiento privado y cifrado, posibilidad de borrarlas (datos de salud, RGPD).
- **Región UE** para todo lo que guarde datos.
- **Login con Amazon Cognito** (email y contraseña, user pool en la UE). No guardamos contraseñas. La app inicia sesión con `amazon-cognito-identity-js`; la API valida el access token con un guard global (`aws-jwt-verify`) y usa el `sub` como `userId`. Más adelante se podrá añadir Apple/Google.
- **Entrenos:** `Routine` es la plantilla (lo planeado) y `WorkoutSession` lo realizado. Los ejercicios del catálogo base tienen `ownerId` nulo; los de usuario llevan su `userId` y se archivan en vez de borrarse.

## Backend en AWS (decidido)

- **AWS Lambda, no servidor fijo.** La API sigue siendo REST normal; Lambda es solo dónde se ejecuta.
- **Una sola Lambda para toda la API normal (CRUD)** con NestJS: un único arranque en frío para todos los endpoints. No una Lambda por endpoint ni por colección de Mongo.
- **Chat con la IA en streaming:** handler aparte (como máximo 2 funciones en total). Node soporta streaming de forma nativa en Lambda (`awslambda.streamifyResponse`); Python no. Las Function URLs con streaming no funcionan dentro de una VPC, y si el cliente se desconecta la función sigue ejecutándose y cobrando. Pendiente de confirmar: si API Gateway (REST o HTTP) soporta el streaming. Mientras tanto se puede empezar sin streaming (respuesta completa).
- **Pendiente al desplegar:** empaquetado. NestJS usa decoradores con metadatos y esbuild no los emite; usar tsc/SWC o una herramienta (SST, SAM) configurada para ello.
- Reutilizar la conexión a MongoDB entre invocaciones (variable fuera del handler).
- Alerta de facturación en AWS Budgets desde el primer día.

## Orden de trabajo

1. Registro de entrenos (ejercicio, series, repeticiones, peso) con backend y login básico.
2. Endpoint de IA: analizar las últimas semanas y sugerir la próxima sesión.
3. Fotos de progreso con análisis.
4. Dieta y, al pasar a iOS, pasos de Salud.

## Convenciones

- TypeScript estricto en todo el repo.
- El contrato de la API se define en `packages/shared` y lo importan ambos lados.
- Variables de entorno en `.env` (ignorado por git); documentar las necesarias en `.env.example`.
- Idioma de la interfaz: español.
- `packages/shared` se compila a `dist` (`npm run build`); el script `prepare` del repo lo hace tras `npm install`. Si cambias los tipos, vuelve a compilarlo.
