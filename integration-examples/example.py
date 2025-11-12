"""
Приклад інтеграції з CRM через Python
"""

import requests
import json

API_URL = 'https://your-domain.com/api/integration'
API_KEY = 'your_api_key_here'


def send_lead_to_crm(lead_data):
    """
    Відправка ліда в CRM систему
    
    Args:
        lead_data (dict): Дані ліда з полями name, phone, email, location
        
    Returns:
        dict: Результат операції з полями success, leadId, isDuplicate
    """
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
    
    payload = {
        'name': lead_data.get('name'),
        'phone': lead_data.get('phone'),
        'email': lead_data.get('email', 'No Email'),
        'sourceDescription': lead_data.get('location', 'No Location'),
        'utm_source': 'your_partner_name',  # Ваша унікальна мітка
        'utm_medium': lead_data.get('utm_medium', ''),
        'utm_campaign': lead_data.get('utm_campaign', ''),
        'utm_content': lead_data.get('utm_content', ''),
        'utm_term': lead_data.get('utm_term', '')
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
        result = response.json()
        
        if response.status_code == 200:
            print(f'✅ Лід успішно відправлено: {result.get("leadId")}')
            
            if result.get('isDuplicate'):
                print('⚠️ Увага: Це дублікат існуючого ліда')
            
            return {
                'success': True,
                'leadId': result.get('leadId'),
                'isDuplicate': result.get('isDuplicate', False)
            }
        else:
            print(f'❌ Помилка відправки ліда: {result.get("message")}')
            return {
                'success': False,
                'error': result.get('message')
            }
            
    except requests.exceptions.RequestException as e:
        print(f'❌ Помилка з\'єднання: {str(e)}')
        return {
            'success': False,
            'error': str(e)
        }


# Приклад використання
if __name__ == '__main__':
    example_lead = {
        'name': 'Іван Петренко',
        'phone': '+380501234567',
        'email': 'ivan@example.com',
        'location': 'Київ, Україна'
    }
    
    result = send_lead_to_crm(example_lead)
    
    if result['success']:
        print(f'Лід створено з ID: {result["leadId"]}')
    else:
        print(f'Помилка: {result["error"]}')
