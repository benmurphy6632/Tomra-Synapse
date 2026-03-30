# ---- Deps Stage ----
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8080/graphql
ENV NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL

RUN npm run build

# ---- Run Stage (Alpine + non-root) ----
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
CMD ["npm", "start"]