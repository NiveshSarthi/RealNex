# WhatsApp Flow Builder - External API Documentation

## Overview

This API allows external applications to integrate with WhatsApp Flow Builder for managing templates, contacts, and campaigns.

**Base URL:** `https://your-domain.com/api/v1`

---

## Authentication

All endpoints require JWT Bearer token authentication.

### Getting a Token

**POST** `/auth/login`

```bash
curl -X POST https://your-domain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "token_type": "bearer"
}
```

### Using the Token

Include the access token in all API requests:

```bash
curl https://your-domain.com/api/v1/templates \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Token Expiry

- **Access Token:** 30 minutes
- **Refresh Token:** 7 days

To refresh your token:

**POST** `/auth/refresh`

```bash
curl -X POST https://your-domain.com/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

---

## Templates

### List Templates

**GET** `/api/v1/templates`

Fetch all WhatsApp templates for your organization.

```bash
curl https://your-domain.com/api/v1/templates \
  -H "Authorization: Bearer TOKEN"
```

**Response:**

```json
[
  {
    "name": "hello_world",
    "status": "APPROVED",
    "category": "MARKETING",
    "language": "en_US",
    "components": [...]
  }
]
```

### Create Template

**POST** `/api/v1/templates`

```bash
curl -X POST https://your-domain.com/api/v1/templates \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_template",
    "category": "MARKETING",
    "language": "en_US",
    "components": [
      {
        "type": "BODY",
        "text": "Hello {{1}}, your order {{2}} is ready!"
      }
    ]
  }'
```

**Categories:** `MARKETING`, `UTILITY`, `AUTHENTICATION`

### Delete Template

**DELETE** `/api/v1/templates/{name}`

```bash
curl -X DELETE https://your-domain.com/api/v1/templates/my_template \
  -H "Authorization: Bearer TOKEN"
```

---

## Contacts

### List Contacts

**GET** `/api/v1/contacts`

| Parameter | Type   | Description                            |
| --------- | ------ | -------------------------------------- |
| page      | int    | Page number (default: 1)               |
| limit     | int    | Items per page (default: 20, max: 100) |
| search    | string | Search by name or number               |
| tag       | string | Filter by tag                          |

```bash
curl "https://your-domain.com/api/v1/contacts?page=1&limit=20&tag=lead" \
  -H "Authorization: Bearer TOKEN"
```

**Response:**

```json
{
  "contacts": [
    {
      "_id": "60f7c...",
      "name": "John Doe",
      "number": "919876543210",
      "tags": ["lead"]
    }
  ],
  "total": 150,
  "page": 1,
  "pages": 8
}
```

### Create Contact

**POST** `/api/v1/contacts`

```bash
curl -X POST https://your-domain.com/api/v1/contacts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "number": "919876543210",
    "tags": ["lead", "new"]
  }'
```

### Upload Contacts (CSV)

**POST** `/api/v1/contacts/upload`

Upload a CSV file with contacts.

**CSV Format:**

```csv
name,number,tags
John Doe,919876543210,lead;new
Jane Smith,919876543211,customer
```

```bash
curl -X POST https://your-domain.com/api/v1/contacts/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@contacts.csv"
```

---

## Campaigns

### List Campaigns

**GET** `/api/v1/campaigns`

```bash
curl https://your-domain.com/api/v1/campaigns \
  -H "Authorization: Bearer TOKEN"
```

**Response:**

```json
[
  {
    "_id": "60f7c...",
    "template_name": "hello_world",
    "status": "completed",
    "total_contacts": 100,
    "stats": {
      "sent": 98,
      "delivered": 95,
      "read": 50,
      "failed": 2
    },
    "created_at": "2026-02-03T07:00:00Z"
  }
]
```

### Get Campaign Details

**GET** `/api/v1/campaigns/{campaign_id}`

```bash
curl https://your-domain.com/api/v1/campaigns/60f7c123... \
  -H "Authorization: Bearer TOKEN"
```

### Get Campaign Logs

**GET** `/api/v1/campaigns/{campaign_id}/logs`

| Parameter | Type   | Description                                     |
| --------- | ------ | ----------------------------------------------- |
| status    | string | Filter by status: sent, delivered, read, failed |

```bash
curl "https://your-domain.com/api/v1/campaigns/60f7c.../logs?status=failed" \
  -H "Authorization: Bearer TOKEN"
```

### Create Campaign

**POST** `/api/v1/campaigns`

Send messages immediately or schedule for later.

```bash
curl -X POST https://your-domain.com/api/v1/campaigns \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "hello_world",
    "language_code": "en_US",
    "contact_ids": ["60f7c123...", "60f7c456..."],
    "variable_mapping": {
      "1": "{{name}}",
      "2": "Your order is ready"
    }
  }'
```

**Request Body:**

| Field            | Type   | Required | Description                               |
| ---------------- | ------ | -------- | ----------------------------------------- |
| template_name    | string | Yes      | Name of approved template                 |
| language_code    | string | No       | Default: "en_US"                          |
| contact_ids      | array  | No\*     | Specific contact IDs                      |
| filters          | object | No\*     | Filter contacts (e.g., `{"tag": "lead"}`) |
| variable_mapping | object | No       | Template variable values                  |
| schedule_time    | string | No       | ISO datetime for scheduling               |

\*Either `contact_ids` or `filters` must be provided.

**Variable Mapping Special Values:**

- `{{name}}` - Replaced with contact's name
- `{{number}}` - Replaced with contact's number
- Any other string - Used as-is

**Scheduling Example:**

```json
{
  "template_name": "promo_offer",
  "filters": { "tag": "subscriber" },
  "variable_mapping": { "1": "{{name}}" },
  "schedule_time": "2026-02-05T10:00:00Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here"
}
```

| Status Code | Description                             |
| ----------- | --------------------------------------- |
| 400         | Bad Request - Invalid input             |
| 401         | Unauthorized - Invalid or expired token |
| 403         | Forbidden - Insufficient permissions    |
| 404         | Not Found - Resource doesn't exist      |
| 500         | Server Error                            |

---

## Rate Limits

- **Login:** 5 requests per minute per IP
- **API calls:** 100 requests per minute per user

---

## Example: Complete n8n Workflow

```javascript
// 1. Login and get token
const loginResponse = await $http.post("https://your-domain.com/auth/login", {
  email: "admin@example.com",
  password: "password",
});
const token = loginResponse.data.access_token;

// 2. Get contacts with specific tag
const contacts = await $http.get(
  "https://your-domain.com/api/v1/contacts?tag=lead",
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);

// 3. Start a campaign
const campaign = await $http.post(
  "https://your-domain.com/api/v1/campaigns",
  {
    template_name: "welcome_message",
    filters: { tag: "new" },
    variable_mapping: { 1: "{{name}}" },
  },
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
```
