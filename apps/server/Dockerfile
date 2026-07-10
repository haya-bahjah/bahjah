FROM node:20-slim AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm install
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build:shared
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma
RUN npm run build --workspace=apps/server

FROM node:20-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/server apps/server
COPY apps/web apps/web
EXPOSE 3001
# Applies any pending Prisma migrations and idempotently seeds the trivia
# question / knows-you-best prompt banks before the server starts -- safe
# to run on every boot (migrate deploy only applies pending migrations,
# and seed.ts skips tables that already have rows).
CMD ["npm", "run", "start:prod", "--workspace=apps/server"]
