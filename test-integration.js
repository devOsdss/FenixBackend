/**
 * Тестовий скрипт для перевірки Integration API
 * 
 * Використання:
 * 1. Переконайтесь що сервер запущено
 * 2. Встановіть API ключ в .env файлі
 * 3. Запустіть: node test-integration.js
 */

require('dotenv').config();

const testIntegrationAPI = async () => {
    const API_KEY = process.env.INTEGRATION_API_KEY;
    const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
    
    console.log('\n🧪 === Integration API Test Started ===\n');
    
    if (!API_KEY || API_KEY === 'your_secure_integration_api_key_here_change_this') {
        console.error('❌ Помилка: INTEGRATION_API_KEY не налаштований в .env файлі');
        console.log('\n📝 Дії:');
        console.log('1. Відкрийте файл .env');
        console.log('2. Змініть INTEGRATION_API_KEY на реальний ключ');
        console.log('3. Перезапустіть сервер і цей скрипт\n');
        process.exit(1);
    }
    
    console.log('✅ API Key знайдено:', '***' + API_KEY.slice(-4));
    console.log('🌐 Base URL:', BASE_URL);
    console.log('\n');
    
    // Тест 1: Створення нового ліда
    console.log('📋 Тест 1: Створення нового ліда');
    console.log('─────────────────────────────────');
    
    const newLeadData = {
        name: 'Тестовий Користувач',
        phone: '+380' + Math.floor(Math.random() * 1000000000),
        email: 'test@example.com',
        sourceDescription: 'Київ, Україна',
        utm_source: 'test_script',
        utm_medium: 'api',
        utm_campaign: 'integration_test'
    };
    
    try {
        const response1 = await fetch(`${BASE_URL}/api/integration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(newLeadData)
        });
        
        const result1 = await response1.json();
        
        if (response1.ok) {
            console.log('✅ Статус:', response1.status);
            console.log('✅ Відповідь:', JSON.stringify(result1, null, 2));
            console.log('✅ Lead ID:', result1.leadId);
            console.log('✅ Статус ліда:', result1.status);
        } else {
            console.log('❌ Помилка:', response1.status);
            console.log('❌ Відповідь:', JSON.stringify(result1, null, 2));
        }
    } catch (error) {
        console.error('❌ Помилка виконання запиту:', error.message);
        console.log('\n💡 Переконайтесь що сервер запущено на', BASE_URL);
    }
    
    console.log('\n');
    
    // Тест 2: Спроба створити дублікат
    console.log('📋 Тест 2: Перевірка дублікатів');
    console.log('─────────────────────────────────');
    
    try {
        const response2 = await fetch(`${BASE_URL}/api/integration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(newLeadData) // Той самий номер телефону
        });
        
        const result2 = await response2.json();
        
        if (response2.ok) {
            console.log('✅ Статус:', response2.status);
            console.log('✅ Відповідь:', JSON.stringify(result2, null, 2));
            
            if (result2.isDuplicate) {
                console.log('✅ Дублікат правильно визначено!');
            } else {
                console.log('⚠️  Увага: Дублікат не визначено (можливо база очищена)');
            }
        } else {
            console.log('❌ Помилка:', response2.status);
            console.log('❌ Відповідь:', JSON.stringify(result2, null, 2));
        }
    } catch (error) {
        console.error('❌ Помилка виконання запиту:', error.message);
    }
    
    console.log('\n');
    
    // Тест 3: Помилка без API ключа
    console.log('📋 Тест 3: Запит без API ключа (очікується помилка 401)');
    console.log('──────────────────────────────────────────────────────────');
    
    try {
        const response3 = await fetch(`${BASE_URL}/api/integration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Без X-API-Key
            },
            body: JSON.stringify(newLeadData)
        });
        
        const result3 = await response3.json();
        
        if (response3.status === 401) {
            console.log('✅ Очікувана помилка 401 отримана');
            console.log('✅ Відповідь:', JSON.stringify(result3, null, 2));
        } else {
            console.log('⚠️  Несподіваний статус:', response3.status);
            console.log('⚠️  Відповідь:', JSON.stringify(result3, null, 2));
        }
    } catch (error) {
        console.error('❌ Помилка виконання запиту:', error.message);
    }
    
    console.log('\n');
    
    // Тест 4: Помилка без обов'язкових полів
    console.log('📋 Тест 4: Запит без обов\'язкових полів (очікується помилка 400)');
    console.log('────────────────────────────────────────────────────────────────');
    
    try {
        const response4 = await fetch(`${BASE_URL}/api/integration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                email: 'test@example.com'
                // Без name та phone
            })
        });
        
        const result4 = await response4.json();
        
        if (response4.status === 400) {
            console.log('✅ Очікувана помилка 400 отримана');
            console.log('✅ Відповідь:', JSON.stringify(result4, null, 2));
        } else {
            console.log('⚠️  Несподіваний статус:', response4.status);
            console.log('⚠️  Відповідь:', JSON.stringify(result4, null, 2));
        }
    } catch (error) {
        console.error('❌ Помилка виконання запиту:', error.message);
    }
    
    console.log('\n🧪 === Integration API Test Completed ===\n');
};

// Запуск тестів
testIntegrationAPI();
