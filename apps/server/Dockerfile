FROM node:20-slim AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm install
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build:shared
RUN npm run build --workspace=apps/server
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

FROM node:20-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/server apps/server
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
