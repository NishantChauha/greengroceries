# Auth Testing Playbook — Green Groceries

## Credentials
- Admin: `admin@greengroceries.com` / `admin123`
- Register a hotel via UI or `POST /api/auth/register`

## API Tests (use REACT_APP_BACKEND_URL)
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -c cookies.txt -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@greengroceries.com","password":"admin123"}'
curl -b cookies.txt "$API/api/auth/me"
curl -b cookies.txt "$API/api/stats"
```

## MongoDB
- `db.users` — unique index on `email`. Admin hash starts with `$2b$`.
- `db.items` — unique index on `name`. Pre-seeded with 10 items.
- `db.orders` — indexed on `order_date` and `hotel_id`.
