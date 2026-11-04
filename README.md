# Élite Trainer

Registro de entrenos con IA. Monorepo con npm workspaces.

## Arranque

```bash
npm install      # instala y compila packages/shared
npm run api      # NestJS en http://localhost:3001 (GET /health)
npm run mobile   # Expo en modo web
```

## Carpetas

- `apps/mobile`: Expo (PWA ahora, iOS después)
- `apps/api`: NestJS (servidor local en `main.ts`, handler de Lambda en `lambda.ts`)
- `packages/shared`: tipos compartidos (se compila a `dist`)

Ver `CLAUDE.md` para las decisiones de arquitectura.
