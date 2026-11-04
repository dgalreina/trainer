# Élite Trainer

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
- **Login con Amazon Cognito** (email y contraseña, user pool en la UE). No guardamos contraseñas. La app habla con Cognito por `fetch` directo (`apps/mobile/src/lib/cognito.ts`, sin SDK: mismo código en web, iOS y Android); solo se guarda el refresh token (SecureStore en el móvil, localStorage en la web). La API valida el access token con un guard global (`aws-jwt-verify`) y usa el `sub` como `userId`. Más adelante se podrá añadir Apple/Google.
- **Entrenos:** `Routine` es la plantilla (lo planeado) y `WorkoutSession` lo realizado. Los ejercicios del catálogo base tienen `ownerId` nulo; los de usuario llevan su `userId` y se archivan en vez de borrarse.

## Backend en AWS (decidido)

- **AWS Lambda, no servidor fijo.** La API sigue siendo REST normal; Lambda es solo dónde se ejecuta.
- **Una sola Lambda para toda la API normal (CRUD)** con NestJS: un único arranque en frío para todos los endpoints. No una Lambda por endpoint ni por colección de Mongo.
- **Chat con la IA en streaming:** handler aparte (como máximo 2 funciones en total). Node soporta streaming de forma nativa en Lambda (`awslambda.streamifyResponse`); Python no. Las Function URLs con streaming no funcionan dentro de una VPC, y si el cliente se desconecta la función sigue ejecutándose y cobrando. Pendiente de confirmar: si API Gateway (REST o HTTP) soporta el streaming. Mientras tanto se puede empezar sin streaming (respuesta completa).
- **Empaquetado (resuelto):** `npm run build:lambda --workspace apps/api` compila con tsc y copia el JS con sus dependencias de producción a `apps/api/lambda-dist`. No se usa esbuild: no emite los metadatos de los decoradores y además rompe `mongoose` con `@nestjs/mongoose` ("Cannot set property nextConnectionId").
- **Infraestructura con AWS CDK** en `apps/infra` (stack `TrainerStack`, eu-west-1): Lambda + API Gateway HTTP + presupuesto mensual de 10 $. Desplegar: `npm run build:lambda --workspace apps/api` y luego `npx cdk deploy` dentro de `apps/infra`. La URI de Mongo vive en SSM (`/trainer/mongodb-uri`, SecureString), no en variables de entorno. Atlas (M0) permite `0.0.0.0/0` porque Lambda no tiene IP fija: pasar a PrivateLink antes de abrir la app al público.
- **Catálogo base de ejercicios:** `apps/api/seed/exercises.base.json` (133, copiado de zitytraining) y `npm run seed --workspace apps/api` para cargarlo (idempotente).
- **Web:** GitHub Pages en https://dgalreina.github.io/trainer/ (workflow `.github/workflows/pages.yml`).
- Reutilizar la conexión a MongoDB entre invocaciones (variable fuera del handler).
- Alerta de facturación en AWS Budgets desde el primer día.

## Orden de trabajo

1. Registro de entrenos (ejercicio, series, repeticiones, peso) con backend y login básico.
2. Endpoint de IA: analizar las últimas semanas y sugerir la próxima sesión.
3. Fotos de progreso con análisis.
4. Dieta y, al pasar a iOS, pasos de Salud.

## Visión del producto

- **La IA es un entrenador personal omnipresente, dedicado solo al cuerpo del usuario.** No es una función suelta que opina tras un entreno: conoce todo su historial, su estado físico, su peso cada vez que lo registra, lo que come y lo que anda, y sus mejoras. Todo lo que registra la app es información para ese entrenador.
- **Modelo de entreno:** un **Entrenamiento** (por ejemplo "Fuerza") tiene nombre, fecha de inicio y duración en semanas, y contiene las **rutinas** de cada día ("Pecho + Espalda", "Pierna"...). Las rutinas no existen sueltas: viven dentro de un entrenamiento (con id propio, porque las sesiones apuntan a ellas). La semana en curso se calcula con `trainingProgress` (`packages/shared`), por días de calendario y sin horas. El usuario marca cuál es su entrenamiento **actual** (y, más adelante, su dieta actual) en `/me/settings`; "Hoy" lo muestra arriba y ofrece sus rutinas. El catálogo de ejercicios se abre desde Yo > Mi cuenta (no aparece en Entrenamientos), ya no es una pestaña.
- **El descanso entre series es de cada rutina** (`restSeconds` en `Routine`: Sin, 60, 90, 120 o 180 s; 90 por defecto). Se elige en el editor de la rutina y no se cambia durante el entreno. Las rutinas anteriores heredan el descanso que tenía su entrenamiento (el campo antiguo sigue en Mongo solo para eso). Ojo con Zod: un `.default()` dentro de un `.partial()` rellena el campo ausente y machaca el valor guardado al editar; por eso crear y editar comparten los campos sin valores por defecto (`trainingFields` en `packages/shared/src/training.ts`, `routineFields` en `routine.ts`).
- **Rutinas: «Día 1», «Día 2»… no es el nombre**, es la posición dentro del entrenamiento (`dayLabel`, `routineTitle` en `packages/shared`). El nombre es opcional ("Pecho + Espalda"). «Nuevo entrenamiento» lo crea al momento (nombre «Nuevo entrenamiento», hoy, 8 semanas; `lib/new-training.ts`) y abre la misma pantalla que editar: no hay pantalla de creación aparte. En esa pantalla el **+** crea la siguiente rutina vacía y sin nombre; los datos del entrenamiento (nombre, fecha, semanas) se guardan solos, sin botón. Una rutina vacía se borra con la ✕ de su tarjeta; con ejercicios, desde dentro.
- **Scroll y pantallas apiladas:** el título (y `fixedTop`) van fijos y solo el contenido se desplaza; sin barras de scroll visibles (`global.css`). Las pantallas apiladas no llevan la barra de pestañas (se descartó mostrarla en todas): más espacio, con la flecha para volver. Llevan flecha «atrás» dibujada (`BackButton`, prop `onBack` de `Screen`) y el título centrado.
- **Sin subtítulos bajo el título de las pestañas** (ahorrar espacio).
- **Pestañas y «Yo»:** las pestañas son Hoy · Calendario · Entrenos · Dietas · Yo (Cuenta ya no es pestaña; Yo va la última). «Yo» tiene dos botones: **Mis datos** y **Mi cuenta** (sesión, modo claro, catálogo de ejercicios, cerrar sesión; `components/account-section.tsx`). **Calendario** es su propia pestaña (`screens/calendar.tsx`) (título del día con flechas para ir al anterior o siguiente, sin tira semanal, y debajo el día con las horas de arriba abajo, con cada entreno y cada pesada a su hora; se mueven arrastrando el asa «≡» de la tarjeta, con ajuste a 5 min, y se guarda con `PATCH /sessions/:id` o `PATCH /me/weights/:id`; las comidas se añadirán con la dieta; es la base de la gráfica de ondas) y **Mis datos** (nombre, fecha de nacimiento, sexo, altura, nivel de actividad, objetivo y notas/lesiones para el entrenador; el peso no es un campo suelto sino un registro de pesadas con fecha y hora). API: `/me/profile` (GET y PUT parcial; `null` borra un dato), `/me/weights` (rango `from`/`to`, `latest`, alta y baja) y `/sessions?from=&to=`. Todos los datos para calcular calorías (Mifflin-St Jeor) salen de aquí. Las fechas y horas viajan en ISO 8601 y el día de calendario se calcula con la hora del dispositivo.
- **Catálogo de alimentos (hecho):** igual que el de ejercicios pero con macros. Un `Food` guarda kcal, proteína, hidratos y grasa **por 100 g** más porciones caseras; las macros de una cantidad las calcula siempre el código (`foodMacros`, `sumMacros` en `packages/shared/src/food.ts`), nunca la IA. Base de 119 alimentos en `apps/api/seed/foods.base.json` (valores orientativos de tablas habituales, pendientes de revisar), cargados con `npm run seed --workspace apps/api` (idempotente; también carga los ejercicios). API `/foods` (listar con `q`, crear, editar, archivar); un nombre repetido da 409 (no se devuelve el existente como en ejercicios, porque las macros pueden diferir). Pantalla en `/alimentos`, desde Dieta. Siguiente: dieta manual (comidas con hora y alimentos con gramos), el registro de lo comido en el calendario, y más tarde la IA que traduce texto libre a alimentos del catálogo. Las comidas referencian alimentos por id: al editar uno, cambian sus macros pasadas (si molesta, guardar una copia de las macros en cada comida registrada).
- **Dieta (primera versión hecha):** una `Diet` tiene nombre, objetivo (`GOALS`) y fecha de inicio, y dentro las **comidas** (`Meal`: nombre, hora "HH:MM" y alimentos con gramos; con id propio, el registro de lo comido apuntará a ellas). API `/diets` (CRUD) y `/diets/:id/meals` (alta, edición y baja; cada operación devuelve la dieta completa, con las comidas por hora). La dieta actual se marca en `/me/settings` (`activeDietId`, validado; se desactiva al borrarla). Pantallas: lista en la pestaña Dieta y detalle en `/mi-dieta/[id]` (`screens/diet-editor.tsx`, comidas en `components/meal-card.tsx`, con buscador de alimentos y cantidad en gramos o por porción). **El objetivo diario no se guarda: lo calcula `calculateTargets` (packages/shared/src/diet.ts) con los datos de «Yo» y el último peso:** Mifflin-St Jeor × factor de actividad; ajuste -15 % / 0 / +10 % según objetivo; topes duros (déficit máximo del 25 %, nunca por debajo de 1200 kcal mujer / 1500 hombre ni del metabolismo basal, y proteína máx. 35 % de las calorías); proteína por kg según objetivo, grasa 25 % y el resto hidratos. Si faltan datos del perfil, la pantalla dice cuáles. **Registro de lo comido (hecho):** `MealLog` (colección `meal_logs`) es lo realizado, como `WorkoutSession`; la dieta es lo planeado. Cada alimento guarda **una copia de sus macros al registrarlo** (las calcula el servidor con `foodMacros`), así que editar un alimento del catálogo no cambia lo ya comido. API `/me/meals` (rango `from`/`to`, alta, edición y baja; mover la hora no recalcula nada). En «Yo»: las comidas salen en el calendario (salmón = ingesta; los entrenos son azul cielo = gasto, token `skySoft`) y se arrastran como lo demás; debajo, `MealLogSection` con el total comido frente al objetivo, la lista del día y «Registrar comida», que puede empezar desde una comida de la dieta actual. **Pendiente:** mostrar la dieta actual en «Hoy», editar una comida ya registrada (hoy se borra y se vuelve a crear), y la IA.
- **Pantalla principal ("Hoy"):** el usuario elige qué entrena hoy (Pecho, Hombro, Espalda...); al tocarlo se abre el entreno del día, donde ve y modifica pesos y repeticiones, con botón "Comenzar" arriba, "Finalizar" abajo y un temporizador de descanso opcional entre series. Al finalizar, la IA da su opinión sobre cómo ha ido.
- **Sin entrenamiento asignado**, la pantalla principal invita a hablar con la IA para que genere uno según las necesidades del usuario.
- **Cómo encaja con las decisiones técnicas** (al construirlo):
  - El contexto de la IA sigue siendo mínimo: un resumen compacto y mantenido por el código del estado del usuario (objetivos, lesiones, tendencias) más herramientas (tool use) para consultar datos concretos bajo demanda, en vez de volcar el historial en cada llamada.
  - Lo que la IA genera (rutinas, ajustes) sale como datos estructurados validados con los esquemas de `packages/shared` y usando ejercicios del catálogo por id; nunca texto libre que la app tenga que interpretar.
  - Los cálculos de calorías y macros siguen en código; los topes de seguridad no dependen de la IA. No da consejo médico.
  - Guardar siempre `userId` y tokens por llamada, y `max_tokens` limitado.
- **El entreno en curso se guarda como borrador en el dispositivo** (el gimnasio implica bloquear el móvil o cambiar de app). El temporizador de descanso se calcula con la hora de fin, no con una cuenta atrás: iOS suspende las PWA en segundo plano. Hoy vive en `lib/workout-draft.ts` y se guarda con `lib/storage.ts`: en la web va a localStorage; en iOS/Android SecureStore se queda corto (límite de ~2 KB por valor), así que al hacer la app nativa hay que pasar el borrador a un almacenamiento de ficheros (por ejemplo `expo-file-system`). El aviso de fin de descanso (vibración y pitido) solo funciona con la app abierta y en primer plano.

## Diseño

- **App luminosa:** predomina el blanco. El color de la app es el **rosa-salmón** (acción principal, ingesta); el naranja solo en último caso; el azul cielo y el azul verdoso son acentos y se reservan sobre todo para el gasto de calorías. Limpio y minimalista. Tokens en `constants/theme.ts`, nunca colores sueltos en las pantallas; la paleta fina se afinará más adelante. Texto sobre salmón en oscuro, y `primaryText` (salmón más profundo) para texto y enlaces, porque el salmón base no tiene contraste sobre blanco.
- **Las ondas son el motivo principal** de la identidad visual: anchas, redondeadas, con degradado y dominadas por el salmón y el rosa (componente `Waves`). El azul solo asoma como un matiz aparte que se desvanece: mezclado con el salmón en el degradado sale un malva grisáceo. En modo oscuro se atenúan a la mitad.
- **Visión de la pantalla del día (futuro):** calendario con las horas de arriba abajo y los eventos marcados (comida, entreno...). Detrás, una gráfica de ondas superpuestas sobre la línea del 0 de calorías, en el centro:
  - **Azul (gasto):** metabolismo basal (banda tenue constante), pasos y entrenos. Hacia la izquierda.
  - **Rosa (ingesta):** cada comida es un bulto en su hora. Hacia la derecha.
  - **Naranja, por detrás (balance acumulado del día):** cruza la línea del 0; cada comida lo empuja al rosa y el gasto al azul.
  - Cuidado al implementarlo: las tasas por hora y el acumulado tienen escalas muy distintas (normalizarlas por separado y dar los números al tocar una hora); el acumulado va como línea fina con relleno suave para que no se confunda con el rosa; por la mañana el acumulado siempre irá hacia el azul antes de comer, así que conviene marcar el objetivo del día y dibujar el resto del día más tenue, como proyección.
  - Requiere hora en cada comida y entreno. Pasos y energía activa vendrán de Salud en iOS; antes, entrada manual. El basal lo calcula el código (Mifflin-St Jeor).
- **Logo e iconos:** fondo casi blanco, ondas translúcidas en la parte baja (los colores de la app: cielo desvaneciéndose, melocotón, rosa y salmón, que se mezclan donde se cruzan) y una É redondeada en degradado salmón-rosa encima (nombre: "Élite Trainer"). El diseño es código: `apps/mobile/scripts/generate-logo.py` escribe los SVG en `assets/branding/` y renderiza con Chrome todos los PNG (`assets/images/icon.png`, `favicon.png` y, en `public/`, los iconos de la PWA, el de iOS y el maskable). Admite una variante con la É en gris oscuro (`generate-logo.py dark`). Descartado: ondas intensas por todo el cuadrado con azules fuertes (parecía de playa), y ondas opacas sobre fondo salmón (translúcidas se mezclaban en tonos apagados; el fondo casi blanco lo resuelve).
- **Implementación prevista:** `react-native-svg` (funciona igual en web e iOS) con `linearGradient` y curvas suaves; animaciones con Reanimated. Los datos del balance salen del código (Mifflin-St Jeor, energía activa), no de la IA.

## Convenciones

- TypeScript estricto en todo el repo.
- El contrato de la API se define en `packages/shared` y lo importan ambos lados.
- Variables de entorno en `.env` (ignorado por git); documentar las necesarias en `.env.example`.
- Idioma de la interfaz: español.
- `packages/shared` se compila a `dist` (`npm run build`); el script `prepare` del repo lo hace tras `npm install`. Si cambias los tipos, vuelve a compilarlo.

## Git

- **No hacer `commit` ni `push` sin permiso explícito**, aunque se haya dado antes en esa misma conversación. Enseñar lo que se ha hecho y preguntar. Hay un workflow que publica la web en GitHub Pages en cada push a `main`, así que un push también despliega.
