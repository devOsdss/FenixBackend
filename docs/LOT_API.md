# LOT API Documentation

## Overview

LOT (Лот) - это функционал для управления успешными сделками, созданный специально для менеджеров с ролью **Reten**. Система позволяет создавать, редактировать и отслеживать лоты с возможностью изменения суммы в будущем.

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Create LOT](#create-lot)
  - [Get LOTs](#get-lots)
  - [Get LOT by ID](#get-lot-by-id)
  - [Update LOT Amount](#update-lot-amount)
  - [Delete LOT](#delete-lot)
  - [Get LOT Statistics](#get-lot-statistics)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Authentication

All endpoints require JWT authentication via Bearer token:

```http
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### Create LOT

Create a new LOT for a lead.

**Endpoint:** `POST /api/lots`

**Access:** Reten, Admin

**Request Body:**
```json
{
  "leadId": "507f1f77bcf86cd799439011",
  "lotName": "Название лота",
  "amount": 15000,
  "lotDate": "2025-11-26"
}
```

**Validation Rules:**
- `leadId`: Required, valid MongoDB ObjectId
- `lotName`: Required, 3-200 characters
- `amount`: Required, positive number
- `lotDate`: Required, valid date, not in future

**Success Response:** `201 Created`
```json
{
  "success": true,
  "message": "ЛОТ успешно создан",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "lotName": "Название лота",
    "amount": 15000,
    "lotDate": "2025-11-26T00:00:00.000Z",
    "leadId": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Иван Иванов",
      "phone": "+380501234567",
      "email": "ivan@example.com",
      "status": "CONVERTED"
    },
    "assignedTo": {
      "_id": "507f1f77bcf86cd799439013",
      "login": "manager1",
      "email": "manager@example.com",
      "role": "Reten"
    },
    "status": "ACTIVE",
    "amountHistory": [],
    "createdAt": "2025-11-26T12:00:00.000Z",
    "updatedAt": "2025-11-26T12:00:00.000Z"
  }
}
```

**Error Responses:**

`400 Bad Request` - Validation error
```json
{
  "success": false,
  "message": "Ошибка валидации данных",
  "errors": {
    "lotName": "Название лота обязательно",
    "amount": "Сумма должна быть положительным числом"
  }
}
```

`404 Not Found` - Lead not found
```json
{
  "success": false,
  "message": "Лид не найден"
}
```

`409 Conflict` - LOT already exists
```json
{
  "success": false,
  "message": "ЛОТ для этого лида уже существует",
  "data": {
    "existingLotId": "507f1f77bcf86cd799439012"
  }
}
```

---

### Get LOTs

Get list of LOTs with filtering and pagination.

**Endpoint:** `GET /api/lots`

**Access:** All authenticated users (role-based filtering applied)

**Query Parameters:**
```
page=1                    // Page number (default: 1)
limit=20                  // Items per page (default: 20, max: 100)
sortBy=lotDate            // Sort field (default: lotDate)
sortOrder=desc            // Sort order: asc | desc (default: desc)
status=ACTIVE             // Filter by status: ACTIVE | ARCHIVED | CANCELLED
search=текст              // Search in lotName and leadName
startDate=2025-11-01      // Filter by date range (start)
endDate=2025-11-30        // Filter by date range (end)
managerId=507f...         // Filter by manager (Admin only)
team=TeamA                // Filter by team (Admin/TeamLead only)
```

**Role-Based Filtering:**
- **Reten/Manager**: Can only see their own LOTs
- **TeamLead**: Can see team's LOTs
- **Admin**: Can see all LOTs or filter by manager/team

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "lotName": "Название лота",
      "amount": 15000,
      "lotDate": "2025-11-26T00:00:00.000Z",
      "leadId": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Иван Иванов",
        "phone": "+380501234567"
      },
      "assignedTo": {
        "_id": "507f1f77bcf86cd799439013",
        "login": "manager1"
      },
      "status": "ACTIVE",
      "createdAt": "2025-11-26T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Get LOT by ID

Get detailed information about a specific LOT.

**Endpoint:** `GET /api/lots/:id`

**Access:** Authenticated users (access control applied)

**URL Parameters:**
- `id`: LOT ID (MongoDB ObjectId)

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "lotName": "Название лота",
    "amount": 15000,
    "lotDate": "2025-11-26T00:00:00.000Z",
    "leadId": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Иван Иванов",
      "phone": "+380501234567",
      "email": "ivan@example.com",
      "status": "CONVERTED",
      "department": "Sales"
    },
    "assignedTo": {
      "_id": "507f1f77bcf86cd799439013",
      "login": "manager1",
      "email": "manager@example.com",
      "role": "Reten",
      "team": "TeamA"
    },
    "team": "TeamA",
    "department": "Sales",
    "status": "ACTIVE",
    "amountHistory": [
      {
        "previousAmount": 15000,
        "newAmount": 18000,
        "editedBy": {
          "_id": "507f1f77bcf86cd799439013",
          "login": "manager1"
        },
        "editedAt": "2025-11-27T10:00:00.000Z",
        "reason": "Дополнительные услуги"
      }
    ],
    "createdAt": "2025-11-26T12:00:00.000Z",
    "updatedAt": "2025-11-27T10:00:00.000Z"
  }
}
```

**Error Responses:**

`400 Bad Request` - Invalid ID format
```json
{
  "success": false,
  "message": "Некорректный ID ЛОТа"
}
```

`403 Forbidden` - Access denied
```json
{
  "success": false,
  "message": "У вас нет доступа к этому ЛОТу"
}
```

`404 Not Found` - LOT not found
```json
{
  "success": false,
  "message": "ЛОТ не найден"
}
```

---

### Update LOT Amount

Update the amount of a LOT with history tracking.

**Endpoint:** `PATCH /api/lots/:id/amount`

**Access:** Reten (own LOTs only), Admin

**URL Parameters:**
- `id`: LOT ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "amount": 18000,
  "reason": "Дополнительные услуги" // Optional
}
```

**Validation Rules:**
- `amount`: Required, positive number, different from current amount
- `reason`: Optional, max 500 characters

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Сумма ЛОТа успешно обновлена",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "lotName": "Название лота",
    "amount": 18000,
    "amountHistory": [
      {
        "previousAmount": 15000,
        "newAmount": 18000,
        "editedBy": {
          "_id": "507f1f77bcf86cd799439013",
          "login": "manager1"
        },
        "editedAt": "2025-11-27T10:00:00.000Z",
        "reason": "Дополнительные услуги"
      }
    ],
    "updatedAt": "2025-11-27T10:00:00.000Z"
  }
}
```

**Error Responses:**

`400 Bad Request` - Same amount
```json
{
  "success": false,
  "message": "Новая сумма совпадает с текущей"
}
```

`403 Forbidden` - Not own LOT
```json
{
  "success": false,
  "message": "Вы можете редактировать только свои ЛОТы"
}
```

---

### Delete LOT

Soft delete a LOT (Admin only).

**Endpoint:** `DELETE /api/lots/:id`

**Access:** Admin only

**URL Parameters:**
- `id`: LOT ID (MongoDB ObjectId)

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "ЛОТ успешно удален"
}
```

**Error Responses:**

`403 Forbidden` - Not admin
```json
{
  "success": false,
  "message": "Только администратор может удалять ЛОТы"
}
```

`404 Not Found` - LOT not found
```json
{
  "success": false,
  "message": "ЛОТ не найден"
}
```

---

### Get LOT Statistics

Get aggregated statistics for LOTs.

**Endpoint:** `GET /api/lots/stats`

**Access:** TeamLead, Admin

**Query Parameters:**
```
startDate=2025-11-01      // Optional: Start date
endDate=2025-11-30        // Optional: End date
team=TeamA                // Optional: Team filter
```

**Success Response:** `200 OK`

For overall stats:
```json
{
  "success": true,
  "data": {
    "totalAmount": 450000,
    "totalLots": 30,
    "avgAmount": 15000,
    "minAmount": 5000,
    "maxAmount": 50000
  }
}
```

For team stats:
```json
{
  "success": true,
  "data": [
    {
      "managerId": "507f1f77bcf86cd799439013",
      "managerName": "manager1",
      "totalAmount": 150000,
      "totalLots": 10,
      "avgAmount": 15000,
      "minAmount": 8000,
      "maxAmount": 30000
    }
  ]
}
```

---

## Data Models

### Lot Model

```typescript
interface Lot {
  _id: ObjectId;
  lotName: string;                    // 3-200 characters
  amount: number;                     // Positive number
  lotDate: Date;                      // Not in future
  leadId: ObjectId;                   // Reference to Lead
  leadName: string;                   // Cached from Lead
  leadPhone?: string;                 // Cached from Lead
  leadEmail?: string;                 // Cached from Lead
  assignedTo: ObjectId;               // Reference to Admin
  team?: string;                      // Team name
  department?: string;                // Department name
  status: 'ACTIVE' | 'ARCHIVED' | 'CANCELLED';
  amountHistory: AmountHistoryEntry[];
  metadata: Map<string, any>;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface AmountHistoryEntry {
  previousAmount: number;
  newAmount: number;
  editedBy: ObjectId;
  editedAt: Date;
  reason?: string;                    // Max 500 characters
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "errors": {                         // Optional, for validation errors
    "field1": "Error for field1",
    "field2": "Error for field2"
  },
  "error": "Stack trace"              // Only in development mode
}
```

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `500 Internal Server Error` - Server error

---

## Best Practices

### 1. **Always Use Pagination**
```javascript
// Good
GET /api/lots?page=1&limit=20

// Avoid fetching all records
GET /api/lots
```

### 2. **Filter by Date Range**
```javascript
// Get LOTs for current month
const startDate = '2025-11-01';
const endDate = '2025-11-30';
GET /api/lots?startDate=${startDate}&endDate=${endDate}
```

### 3. **Search Efficiently**
```javascript
// Use search parameter for text search
GET /api/lots?search=название
```

### 4. **Track Amount Changes**
```javascript
// Always provide reason when updating amount
PATCH /api/lots/:id/amount
{
  "amount": 18000,
  "reason": "Дополнительные услуги"
}
```

### 5. **Handle Errors Gracefully**
```javascript
try {
  const response = await fetch('/api/lots', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    // Handle error
    console.error(data.message);
    if (data.errors) {
      // Handle validation errors
      Object.keys(data.errors).forEach(field => {
        console.error(`${field}: ${data.errors[field]}`);
      });
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### 6. **Use Transactions for Critical Operations**
All create, update, and delete operations use MongoDB transactions to ensure data consistency.

### 7. **Respect Role-Based Access Control**
- Reten managers can only access their own LOTs
- TeamLeads can access team LOTs
- Admins have full access

---

## Examples

### Create LOT (Frontend)

```typescript
const createLot = async (lotData: {
  leadId: string;
  lotName: string;
  amount: number;
  lotDate: string;
}) => {
  const response = await fetch('/api/lots', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(lotData)
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message);
  }
  
  return data.data;
};
```

### Get LOTs with Filters

```typescript
const getLots = async (filters: {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(`/api/lots?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return response.json();
};
```

### Update LOT Amount

```typescript
const updateLotAmount = async (
  lotId: string,
  amount: number,
  reason?: string
) => {
  const response = await fetch(`/api/lots/${lotId}/amount`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount, reason })
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message);
  }
  
  return data.data;
};
```

---

## Support

For questions or issues, contact the development team.

**Version:** 1.0.0  
**Last Updated:** November 26, 2025  
**Author:** Senior Developer (5+ years experience)
