# API для інтеграції лідів в CRM систему

## Використання API

### Endpoint
```
POST /api/integration
```
### Автентифікація
apiKey: "2781dd5ea1e0e3c057f737e5ba34e15d90f2182a93f0fcf8fff282d4ea0d9dc3"
API ключ може бути переданий двома способами:

#### Варіант 1: Заголовок X-API-Key
```
X-API-Key: your_api_key_here
```

#### Варіант 2: Bearer токен
```
Authorization: Bearer your_api_key_here
```

### Формат запиту

#### Headers
```
Content-Type: application/json
X-API-Key: your_api_key_here
```

#### Body (JSON)

```json
{
  "name": "Ім'я клієнта",
  "phone": "+380501234567",
  "email": "client@example.com",
  "sourceDescription": "DE, FR, IT, ES, EN,....",
  "utm_source": "partner_name"
}
```

### Обов'язкові поля
- `name` (string) - Ім'я клієнта
- `phone` (string) - Номер телефону (буде нормалізовано)

### Опціональні поля
- `email` (string) - Email адреса
- `sourceDescription` (string) - Географічна локація або опис джерела
- `utm_source` (string) - Мітка джерела трафіку (рекомендується для ідентифікації партнера)

### Відповіді API

#### Успішна відповідь (200 OK)

```json
{
  "success": true,
  "message": "Lead created successfully",
  "status": "UC_HSS56X",
  "leadId": "507f1f77bcf86cd799439011",
  "isDuplicate": false
}
```

#### Дублікат ліда (200 OK)

Якщо лід з таким номером телефону вже існує:

```json
{
  "success": true,
  "message": "Lead created successfully",
  "status": "DUPLICATE",
  "leadId": "507f1f77bcf86cd799439012",
  "isDuplicate": true
}
```

#### Помилка валідації (400 Bad Request)

```json
{
  "success": false,
  "message": "Phone number is required"
}
```

#### Помилка автентифікації (401 Unauthorized)

```json
{
  "success": false,
  "message": "Invalid API key"
}
```

#### Серверна помилка (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details"
}
```

## Приклади запитів

### cURL

```bash
curl -X POST https://your-domain.com/api/integration \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "name": "Іван Петренко",
    "phone": "+380501234567",
    "email": "ivan@example.com",
    "sourceDescription": "Київ",
    "utm_source": "partner_crm"
  }'
```

### JavaScript (fetch)

```javascript
fetch('https://your-domain.com/api/integration', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
  },
  body: JSON.stringify({
    name: 'Іван Петренко',
    phone: '+380501234567',
    email: 'ivan@example.com',
    sourceDescription: 'Київ',
    utm_source: 'partner_crm'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### Python (requests)

```python
import requests

url = 'https://your-domain.com/api/integration'
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
}
data = {
    'name': 'Іван Петренко',
    'phone': '+380501234567',
    'email': 'ivan@example.com',
    'sourceDescription': 'Київ',
    'utm_source': 'partner_crm'
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

### PHP

```php
<?php
$url = 'https://your-domain.com/api/integration';
$data = [
    'name' => 'Іван Петренко',
    'phone' => '+380501234567',
    'email' => 'ivan@example.com',
    'sourceDescription' => 'Київ',
    'utm_source' => 'partner_crm'
];

$options = [
    'http' => [
        'header' => [
            'Content-Type: application/json',
            'X-API-Key: your_api_key_here'
        ],
        'method' => 'POST',
        'content' => json_encode($data)
    ]
];

$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);
$response = json_decode($result, true);

print_r($response);
?>
```

## Особливості обробки

### Нормалізація телефону
Всі номери телефонів автоматично нормалізуються - видаляються всі символи крім цифр.

Приклад:
- Вхідний: `+380 (50) 123-45-67`
- Нормалізований: `380501234567`

### Перевірка дублікатів
Система автоматично перевіряє чи існує лід з таким нормалізованим номером телефону:
- Якщо лід існує: статус буде `DUPLICATE`
- Якщо лід новий: статус буде `UC_HSS56X`


## Безпека

- ✅ Всі запити вимагають валідний API ключ
- ✅ API ключ зберігається в змінних оточення (.env)
- ✅ Детальне логування всіх запитів
- ✅ Валідація обов'язкових полів
- ✅ Захист від SQL injection (використовується Mongoose ODM)

## Підтримка

Для отримання API ключа або допомоги з інтеграцією зв'яжіться з адміністратором системи.
