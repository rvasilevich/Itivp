// Самопроверка лабораторной работы по MongoDB + Mongoose
// Запуск: npm run check:mongo   (сервер должен быть запущен: npm run dev)
// Проверяет CRUD /api/v1/mongo/employees и вложенные структуры ($push/$/$inc/$pull)
const PASS = '✅';
const FAIL = '❌';

const BASE = process.env.MONGO_API_URL || 'http://localhost:3000/api/v1/mongo/employees';

function check(name, ok, extra) {
  const line = `${ok ? PASS : FAIL}  ${name}`;
  console.log(ok ? line : line + (extra ? ` — ${extra}` : ''));
  return ok;
}

(async () => {
  const results = [];
  let createdId = null;
  let reviewId = null;

  try {
    // 1. Список (Model.find) — заодно проверяем, что MongoDB отвечает
    const listRes = await fetch(BASE);
    const list = await listRes.json();
    results.push(check('MongoDB: GET /mongo/employees — список получен', listRes.status === 200 && Array.isArray(list), `records=${Array.isArray(list) ? list.length : 'n/a'}`));

    // 2. CREATE (Model.create) с вложенными массивами в самом документе
    const createRes = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Самопроверка Mongo',
        position: 'QA',
        department: 'Тест',
        rating: 7.5,
        skills: [{ name: 'MongoDB', level: 3 }],
        reviews: [{ reviewer: 'Автотест', rating: 7, comment: 'Начальный отзыв', goals: ['Проверить CRUD'] }],
      }),
    });
    const created = await createRes.json();
    createdId = created?._id;
    results.push(check('CRUD: POST (CREATE) → 201, документ со skills[]/reviews[]', createRes.status === 201 && Array.isArray(created.skills) && Array.isArray(created.reviews), `status=${createRes.status}`));

    // 3. READ по id (Model.findById)
    const readRes = await fetch(`${BASE}/${createdId}`);
    const read = await readRes.json();
    results.push(check('CRUD: GET /:id (READ)', readRes.status === 200 && read.name === 'Самопроверка Mongo'));

    // 4. UPDATE (Model.findByIdAndUpdate)
    const putRes = await fetch(`${BASE}/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 8 }),
    });
    const put = await putRes.json();
    results.push(check('CRUD: PUT /:id (UPDATE) → rating=8', putRes.status === 200 && Number(put.rating) === 8));

    // 5. Вложенный документ: новый отзыв через $push
    const reviewRes = await fetch(`${BASE}/${createdId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: 'Ревьюер', rating: 9, comment: 'Отличная работа', goals: ['Сеньор'] }),
    });
    const withReview = await reviewRes.json();
    reviewId = withReview.reviews?.[withReview.reviews.length - 1]?._id;
    results.push(check('Вложенность: POST /:id/reviews добавляет элемент в reviews[] ($push)', reviewRes.status === 201 && withReview.reviews?.length === 2 && typeof reviewId === 'string', `reviews=${withReview.reviews?.length}`));

    // 6. Обновление элемента массива — позиционный оператор "$"
    const reviewPutRes = await fetch(`${BASE}/${createdId}/reviews/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Обновлённый комментарий', rating: 10 }),
    });
    const reviewPut = await reviewPutRes.json();
    const updatedReview = reviewPut.reviews?.find((r) => r._id === reviewId);
    results.push(check('Вложенность: PUT /:reviews/:id меняет конкретный отзыв (оператор $)', reviewPutRes.status === 200 && updatedReview?.comment === 'Обновлённый комментарий' && Number(updatedReview.rating) === 10));

    // 7. Добавить навык ($addToSet), повтор → 409
    const skillRes = await fetch(`${BASE}/${createdId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Docker', level: 2 }),
    });
    const skillDupRes = await fetch(`${BASE}/${createdId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Docker', level: 5 }),
    });
    const afterSkills = await skillRes.json();
    results.push(check('Вложенность: POST /:id/skills добавляет навык, дубликат → 409', skillRes.status === 201 && skillDupRes.status === 409 && afterSkills.skills?.length === 2, `first=${skillRes.status}, dup=${skillDupRes.status}, skills=${afterSkills.skills?.length}`));

    // 8. Увеличить уровень навыка — $inc + позиционный "$" (аналог корзины)
    const incRes = await fetch(`${BASE}/${createdId}/skills/Docker`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 4 }),
    });
    const incDoc = await incRes.json();
    const docker = incDoc.skills?.find((s) => s.name === 'Docker');
    results.push(check('Вложенность: PATCH /:skills/:name — $inc уровня внутри массива (2→6)', incRes.status === 200 && Number(docker?.level) === 6, `level=${docker?.level}`));

    // 9. Удалить отзыв — $pull
    const pullRes = await fetch(`${BASE}/${createdId}/reviews/${reviewId}`, { method: 'DELETE' });
    const pullDoc = await pullRes.json();
    results.push(check('Вложенность: DELETE /:reviews/:id убирает отзыв ($pull)', pullRes.status === 200 && pullDoc.employee?.reviews?.length === 1, `reviews=${pullDoc.employee?.reviews?.length}`));

    // 10. Поиск по документам ($regex)
    const searchRes = await fetch(`${BASE}?search=${encodeURIComponent('Самопроверка')}`);
    const found = await searchRes.json();
    results.push(check('Поиск: ?search= фильтрует документы', searchRes.status === 200 && found.length === 1 && found[0]._id === createdId, `найдено=${found.length}`));

    // 11. Некорректный id → 400 (CastError → AppError)
    const badRes = await fetch(`${BASE}/not-an-object-id`);
    results.push(check('Ошибки: некорректный ID → 400', badRes.status === 400, `status=${badRes.status}`));

    // 12. DELETE (Model.findByIdAndDelete), затем 404
    const delRes = await fetch(`${BASE}/${createdId}`, { method: 'DELETE' });
    const delAgain = await fetch(`${BASE}/${createdId}`);
    results.push(check('CRUD: DELETE /:id → 200, повторный GET → 404', delRes.status === 200 && delAgain.status === 404, `del=${delRes.status}, get=${delAgain.status}`));

    // Демонстрация вложенной структуры (коллекция employees_mongo, смотреть в Compass/Atlas)
    const demo = await fetch(`${BASE}?search=${encodeURIComponent('Иван Иванов')}`);
    const demoList = await demo.json();
    if (demoList[0]) {
      console.log('\n--- Пример документа с вложенными структурами (employees_mongo) ---');
      console.log(JSON.stringify(demoList[0], null, 2));
    }

  } catch (err) {
    results.push(check(`Не удалось выполнить запросы: ${err.message}`, false, `сервер запущен? npm run dev; BASE=${BASE}`));
  } finally {
    const passed = results.filter(Boolean).length;
    console.log(`\nПройдено проверок: ${passed}/${results.length}`);
    console.log(passed === results.length && results.length > 0
      ? 'ВСЕ ЗАДАЧИ ЛАБОРАТОРНОЙ РАБОТЫ ПО MONGODB ВЫПОЛНЕНЫ ✅'
      : 'ЕСТЬ НЕПРОЙДЕННЫЕ ПРОВЕРКИ ❌');
    process.exit(passed === results.length && results.length > 0 ? 0 : 1);
  }
})();