// Глобальный обработчик ошибок (error-handling middleware)
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  // Ошибка приложения (AppError) — известная ошибка с HTTP-статусом
  if (err.isOperational) {
    const response = { error: err.message };

    if (err.details) {
      response.details = err.details;
    }

    return res.status(err.statusCode).json(response);
  }

  // Некорректный JSON в теле запроса
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }

  // Непредвиденная ошибка
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}

module.exports = errorHandler;