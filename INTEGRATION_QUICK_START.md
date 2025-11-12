# Швидкий старт - Integration API

## Крок 1: Налаштування API ключа

Відкрийте файл `.env` і змініть значення `INTEGRATION_API_KEY`:

```env
INTEGRATION_API_KEY=ваш_надійний_ключ_тут
```

**Рекомендація:** Згенеруйте випадковий ключ:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Крок 2: Перезапуск сервера

```bash
npm start
```

## Крок 3: Тестування API

### Швидкий тест через cURL:

```bash
curl -X POST http://localhost:5000/api/integration \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ваш_api_ключ" \
  -d '{
    "name": "Тестовий Лід",
    "phone": "+380501234567",
    "email": "test@example.com",
    "sourceDescription": "Київ",
    "utm_source": "test_integration"
  }'
```

### Очікувана відповідь:

```json
{
  "success": true,
  "message": "Lead created successfully",
  "status": "UC_HSS56X",
  "leadId": "...",
  "isDuplicate": false
}
```

## Що передати партнерам для інтеграції

### 1. API Endpoint
```
POST https://ваш-домен.com/api/integration
```

### 2. API ключ
```
X-API-Key: [згенерований_ключ]
```

### 3. Формат даних

**Обов'язкові поля:**
- `name` - Ім'я клієнта
- `phone` - Номер телефону

**Рекомендовані поля:**
- `email` - Email
- `sourceDescription` - Гео або опис джерела
- `utm_source` - **Унікальна мітка партнера** (щоб ви могли відрізнити звідки лід)

### 4. Приклад запиту (JavaScript)

```javascript
fetch('https://ваш-домен.com/api/integration', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'api_ключ_тут'
  },
  body: JSON.stringify({
    name: 'Іван Іваненко',
    phone: '+380501234567',
    email: 'ivan@example.com',
    sourceDescription: 'Львів',
    utm_source: 'partner_xyz'  // Унікальна мітка партнера
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

## Особливості

✅ **Автоматична нормалізація телефону** - всі символи крім цифр видаляються

✅ **Перевірка дублікатів** - якщо номер вже існує, статус буде `DUPLICATE`

✅ **Миттєві оповіщення** - WebSocket повідомлення в реальному часі

✅ **Захищений доступ** - тільки з правильним API ключем

## Моніторинг

Всі запити логуються в консолі сервера:
- Отримані дані
- Перевірка дублікатів
- Створення ліда
- Результат операції

Для повної документації див. [INTEGRATION_API.md](./INTEGRATION_API.md)
