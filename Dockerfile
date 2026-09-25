# Dockerfile backend-а (Node.js + Express + Socket.IO) — ЛР №8.
#
# Базовый образ node:22-alpine (LTS). Шаблонный node:18-alpine НЕ подходит:
# mongoose@9 требует Node >= 20.19 (см. engines в node_modules/mongoose/package.json),
# а Express 5 — Node >= 18. Alpine выбран для компактности образа.
FROM node:22-alpine

WORKDIR /app

# Инструменты для сборки нативных модулей (bcrypt). Устанавливаются в отдельном
# «виртуальном» наборе и удаляются сразу после npm ci — в финальный образ не попадают.
RUN apk add --no-cache --virtual .build-deps python3 make g++

# Зависимости кэшируются отдельным слоем, пока не менялись package*.json.
# npm ci без NODE_ENV=production ставит и devDependencies: sequelize-cli нужен
# точке входа (docker/entrypoint.sh) для накатывания миграций при старте.
COPY package*.json ./
RUN npm ci && apk del .build-deps

# Режим выполнения приложения и порт (server.js читает PORT через core/config.js)
ENV NODE_ENV=production
ENV PORT=5000

# Исходный код приложения (node_modules/.env исключены через .dockerignore)
COPY . .

# Папка логов монтируется томом backend_logs; entrypoint делаем исполняемым
RUN mkdir -p /app/logs && chmod +x /app/docker/entrypoint.sh

EXPOSE 5000

# Healthcheck (доп. требование): опрашивает эндпоинт GET /health из server.js
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Точка входа: миграции + сиды (один раз), затем CMD — запуск сервера
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "server.js"]
