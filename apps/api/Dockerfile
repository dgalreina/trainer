# Imagen del API para un servidor siempre encendido (App Runner). El contexto es la raíz del repo:
#   docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo

# Los package.json de todos los workspaces, para que `npm ci` vea el lockfile completo.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/infra/package.json apps/infra/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund --workspace packages/shared --workspace apps/api

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace packages/shared
# Mismo empaquetado que la Lambda (tsc + dependencias de producción en lambda-dist), que ya
# resuelve @trainer/shared y evita esbuild (rompe mongoose).
RUN npm run build:lambda --workspace apps/api

FROM node:22-slim
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build /repo/apps/api/lambda-dist ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
