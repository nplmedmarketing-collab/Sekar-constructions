# Sekar Construction API — production image (Render / Railway / any container host)
FROM node:20-bookworm-slim

WORKDIR /app

# bcrypt native build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Migrate then start. DATABASE_URL / SESSION_SECRET / CORS_ORIGINS must be set by the host.
CMD ["sh", "-c", "npm run migrate && npm start"]
