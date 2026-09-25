#!/bin/sh
# Точка входа backend-контейнера (ЛР №8).
#
#  1) применяет миграции Sequelize к PostgreSQL (идемпотентно — журнал SequelizeMeta);
#  2) наполняет БД сидами только если она пустая (сиды через bulkInsert НЕ идемпотентны,
#     а Users.email — UNIQUE, поэтому повторный прогон упал бы с ошибкой дубля);
#  3) передаёт управление CMD — `node server.js` (Express + Socket.IO на PORT).
#
# Переменные окружения (задаёт docker-compose):
#   DATABASE_URL    — строка подключения к PostgreSQL
#   RUN_MIGRATIONS  — "true"/"false", можно отключить миграции (например, для Supabase)
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Применяем миграции: sequelize-cli db:migrate"
  ./node_modules/.bin/sequelize-cli db:migrate

  echo "[entrypoint] Проверяем, наполнена ли БД (таблица Users)…"
  SEEDED="$(node -e "
    const { Sequelize } = require('sequelize');
    const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: false });
    sequelize.query('SELECT COUNT(*)::int AS count FROM \"Users\"')
      .then(([rows]) => console.log(rows[0].count))
      .catch(() => console.log('0'))
      .finally(() => sequelize.close());
  ")"

  if [ "$SEEDED" = "0" ]; then
    echo "[entrypoint] БД пустая — выполняем сиды: sequelize-cli db:seed:all"
    ./node_modules/.bin/sequelize-cli db:seed:all
  else
    echo "[entrypoint] Пользователи уже есть (Users=$SEEDED) — сиды пропускаем."
  fi
else
  echo "[entrypoint] RUN_MIGRATIONS=false — миграции и сиды пропущены."
fi

echo "[entrypoint] Запуск приложения: $*"
exec "$@"
