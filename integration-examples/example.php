<?php
/**
 * Приклад інтеграції з CRM через PHP
 */

define('API_URL', 'https://your-domain.com/api/integration');
define('API_KEY', 'your_api_key_here');

/**
 * Відправка ліда в CRM систему
 *
 * @param array $leadData Дані ліда з полями name, phone, email, location
 * @return array Результат операції
 */
function sendLeadToCRM($leadData) {
    $payload = [
        'name' => $leadData['name'],
        'phone' => $leadData['phone'],
        'email' => $leadData['email'] ?? 'No Email',
        'sourceDescription' => $leadData['location'] ?? 'No Location',
        'utm_source' => 'your_partner_name', // Ваша унікальна мітка
        'utm_medium' => $leadData['utm_medium'] ?? '',
        'utm_campaign' => $leadData['utm_campaign'] ?? '',
        'utm_content' => $leadData['utm_content'] ?? '',
        'utm_term' => $leadData['utm_term'] ?? ''
    ];

    $options = [
        'http' => [
            'header' => [
                'Content-Type: application/json',
                'X-API-Key: ' . API_KEY
            ],
            'method' => 'POST',
            'content' => json_encode($payload),
            'timeout' => 30
        ]
    ];

    $context = stream_context_create($options);
    
    try {
        $response = file_get_contents(API_URL, false, $context);
        
        if ($response === false) {
            $error = error_get_last();
            echo "❌ Помилка з'єднання: " . $error['message'] . "\n";
            return [
                'success' => false,
                'error' => $error['message']
            ];
        }
        
        $result = json_decode($response, true);
        
        if (isset($result['success']) && $result['success']) {
            echo "✅ Лід успішно відправлено: " . $result['leadId'] . "\n";
            
            if (!empty($result['isDuplicate'])) {
                echo "⚠️ Увага: Це дублікат існуючого ліда\n";
            }
            
            return [
                'success' => true,
                'leadId' => $result['leadId'],
                'isDuplicate' => $result['isDuplicate'] ?? false
            ];
        } else {
            echo "❌ Помилка відправки ліда: " . ($result['message'] ?? 'Unknown error') . "\n";
            return [
                'success' => false,
                'error' => $result['message'] ?? 'Unknown error'
            ];
        }
        
    } catch (Exception $e) {
        echo "❌ Помилка: " . $e->getMessage() . "\n";
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

// Приклад використання
$exampleLead = [
    'name' => 'Іван Петренко',
    'phone' => '+380501234567',
    'email' => 'ivan@example.com',
    'location' => 'Київ, Україна'
];

$result = sendLeadToCRM($exampleLead);

if ($result['success']) {
    echo "Лід створено з ID: " . $result['leadId'] . "\n";
} else {
    echo "Помилка: " . $result['error'] . "\n";
}
?>
