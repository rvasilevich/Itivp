# Dockerfile frontend-а (React + Vite) — многоэтапная сборка (ЛР №8).
#
# Этап 1 (builder): ставим зависимости и собираем production-бандл (dist/).
# Этап 2 (nginx):   только статика + nginx, который дополнительно работает
#                   reverse-proxy для /api/ и /socket.io/ (см. nginx.conf).
# Итоговый образ не содержит Node.js и node_modules — только статику и nginx.

# ---------- Этап 1: сборка ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Зависимости отдельным слоем (кэш) — включая devDependencies (vite)
COPY package*.json ./
RUN npm ci

COPY . .

# Адреса передаются на этапе СБОРКИ: Vite «зашивает» import.meta.env.* в бандл.
# По умолчанию — относительные пути (/api/v1 и same-origin), т.е. браузер
# обращается к тому же origin, а запросы проксирует nginx (см. nginx.conf).
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=same-origin
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# ---------- Этап 2: раздача статики через nginx ----------
FROM nginx:alpine

# Собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

# Конфиг nginx: SPA + reverse-proxy на backend:5000
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
