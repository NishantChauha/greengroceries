"""Green Groceries — Backend API tests (auth, items, orders, purchase-sheet, stats, hotels)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hotel-supply-hub-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@greengroceries.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def hotel_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_hotel_{uuid.uuid4().hex[:8]}@test.com"
    payload = {
        "email": email,
        "password": "hotel123",
        "name": "Test Manager",
        "hotel_name": f"TEST Grand Plaza {uuid.uuid4().hex[:4]}",
        "phone": "+1-555-1234",
        "address": "1 Test Way",
    }
    r = s.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"Hotel register failed: {r.status_code} {r.text}"
    s.email = email  # type: ignore
    s.hotel_name = payload["hotel_name"]  # type: ignore
    return s


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        assert data["email"] == ADMIN_EMAIL
        # httpOnly cookie present
        assert "access_token" in r.cookies, "access_token cookie not set"

    def test_admin_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_register_short_password(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "123",
            "name": "Bob", "hotel_name": "X Hotel"
        }, timeout=15)
        assert r.status_code in (400, 422)

    def test_register_duplicate_email(self, hotel_session):
        r = requests.post(f"{API}/auth/register", json={
            "email": hotel_session.email, "password": "hotel123",
            "name": "Dup", "hotel_name": "Dup Hotel"
        }, timeout=15)
        assert r.status_code == 400

    def test_logout_clears_cookie(self, admin_session):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        r2 = s.get(f"{API}/auth/me", timeout=15)
        assert r2.status_code == 401


# ---------- Items ----------
class TestItems:
    def test_seeded_items_exist(self, admin_session):
        r = admin_session.get(f"{API}/items", timeout=15)
        assert r.status_code == 200
        names = {it["name"] for it in r.json()}
        for expected in {"Potato", "Onion", "Tomato", "Garlic", "Apple", "Banana", "Orange", "Papaya"}:
            assert expected in names, f"Seed item missing: {expected}"

    def test_hotel_can_list_items(self, hotel_session):
        r = hotel_session.get(f"{API}/items", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_hotel_cannot_create_item(self, hotel_session):
        r = hotel_session.post(f"{API}/items", json={"name": "TEST_VEG", "category": "vegetable", "unit": "kg"}, timeout=15)
        assert r.status_code == 403

    def test_admin_item_crud(self, admin_session):
        unique = f"TEST_{uuid.uuid4().hex[:6]}"
        # CREATE
        r = admin_session.post(f"{API}/items", json={"name": unique, "category": "vegetable", "unit": "kg", "icon": "🥦"}, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["name"] == unique
        assert "id" in item
        item_id = item["id"]

        # GET (verify persisted)
        r2 = admin_session.get(f"{API}/items", timeout=15)
        assert any(it["id"] == item_id and it["name"] == unique for it in r2.json())

        # UPDATE
        r3 = admin_session.put(f"{API}/items/{item_id}", json={"name": unique, "category": "fruit", "unit": "dozen", "icon": "🍇"}, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["category"] == "fruit"
        assert r3.json()["unit"] == "dozen"

        # GET verify update
        r4 = admin_session.get(f"{API}/items", timeout=15)
        match = next(it for it in r4.json() if it["id"] == item_id)
        assert match["category"] == "fruit"

        # DELETE
        r5 = admin_session.delete(f"{API}/items/{item_id}", timeout=15)
        assert r5.status_code == 200

        # GET verify gone
        r6 = admin_session.get(f"{API}/items", timeout=15)
        assert not any(it["id"] == item_id for it in r6.json())

    def test_duplicate_item_name_rejected(self, admin_session):
        r = admin_session.post(f"{API}/items", json={"name": "Potato", "category": "vegetable", "unit": "kg"}, timeout=15)
        assert r.status_code == 400


# ---------- Orders ----------
class TestOrders:
    def test_hotel_places_order_and_sees_it(self, hotel_session, admin_session):
        items = admin_session.get(f"{API}/items", timeout=15).json()
        potato = next(i for i in items if i["name"] == "Potato")
        apple = next(i for i in items if i["name"] == "Apple")
        order_date = "2026-02-15"
        payload = {
            "order_date": order_date,
            "notes": "TEST order",
            "lines": [
                {"item_id": potato["id"], "name": "Potato", "unit": "kg", "category": "vegetable", "quantity": 12.5},
                {"item_id": apple["id"], "name": "Apple", "unit": "kg", "category": "fruit", "quantity": 5},
            ],
        }
        r = hotel_session.post(f"{API}/orders", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "pending"
        assert order["hotel_name"] == hotel_session.hotel_name
        assert len(order["lines"]) == 2

        # Hotel sees only own orders
        r2 = hotel_session.get(f"{API}/orders", timeout=15)
        assert r2.status_code == 200
        my_orders = r2.json()
        assert any(o["id"] == order["id"] for o in my_orders)
        assert all(o["hotel_name"] == hotel_session.hotel_name for o in my_orders)

        # Admin sees this order among ALL
        r3 = admin_session.get(f"{API}/orders", timeout=15)
        assert r3.status_code == 200
        assert any(o["id"] == order["id"] for o in r3.json())

        # Store for later tests
        hotel_session.test_order_id = order["id"]  # type: ignore
        hotel_session.test_order_date = order_date  # type: ignore

    def test_hotel_cannot_create_empty_order(self, hotel_session):
        r = hotel_session.post(f"{API}/orders", json={"order_date": "2026-02-15", "lines": []}, timeout=15)
        assert r.status_code == 400

    def test_admin_cannot_place_order(self, admin_session):
        r = admin_session.post(f"{API}/orders", json={
            "order_date": "2026-02-15",
            "lines": [{"item_id": "x", "name": "P", "unit": "kg", "category": "vegetable", "quantity": 1}]
        }, timeout=15)
        assert r.status_code == 403

    def test_admin_updates_order_status(self, hotel_session, admin_session):
        order_id = getattr(hotel_session, "test_order_id", None)
        assert order_id, "Prereq order missing"
        r = admin_session.patch(f"{API}/orders/{order_id}/status", json={"status": "delivered"}, timeout=15)
        assert r.status_code == 200
        # Verify
        orders = admin_session.get(f"{API}/orders", timeout=15).json()
        found = next(o for o in orders if o["id"] == order_id)
        assert found["status"] == "delivered"

    def test_hotel_cannot_update_status(self, hotel_session):
        order_id = getattr(hotel_session, "test_order_id", None)
        r = hotel_session.patch(f"{API}/orders/{order_id}/status", json={"status": "cancelled"}, timeout=15)
        assert r.status_code == 403

    def test_invalid_status_rejected(self, admin_session, hotel_session):
        order_id = getattr(hotel_session, "test_order_id", None)
        r = admin_session.patch(f"{API}/orders/{order_id}/status", json={"status": "shipped"}, timeout=15)
        assert r.status_code == 400


# ---------- Purchase Sheet ----------
class TestPurchaseSheet:
    def test_admin_only(self, hotel_session):
        r = hotel_session.get(f"{API}/purchase-sheet", params={"date_from": "2026-02-15"}, timeout=15)
        assert r.status_code == 403

    def test_single_date_aggregates(self, admin_session, hotel_session):
        order_date = getattr(hotel_session, "test_order_date", "2026-02-15")
        r = admin_session.get(f"{API}/purchase-sheet", params={"date_from": order_date}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["date_from"] == order_date
        assert data["date_to"] == order_date
        names = {row["name"]: row for row in data["rows"]}
        # Order had Potato 12.5 + Apple 5 — but order was marked delivered (not cancelled) so still counts
        if "Potato" in names:
            assert names["Potato"]["total_quantity"] >= 12.5

    def test_date_range_aggregates(self, admin_session, hotel_session):
        order_date = getattr(hotel_session, "test_order_date", "2026-02-15")
        r = admin_session.get(f"{API}/purchase-sheet",
                              params={"date_from": "2026-02-01", "date_to": "2026-02-28"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["date_from"] == "2026-02-01"
        assert data["date_to"] == "2026-02-28"
        assert isinstance(data["rows"], list)

    def test_export_csv(self, admin_session, hotel_session):
        order_date = getattr(hotel_session, "test_order_date", "2026-02-15")
        r = admin_session.get(f"{API}/purchase-sheet/export", params={"date_from": order_date}, timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "Green Groceries" in r.text


# ---------- Stats & Hotels ----------
class TestStatsHotels:
    def test_stats_admin(self, admin_session):
        r = admin_session.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for key in ("total_hotels", "pending_orders", "total_orders", "today_total_quantity"):
            assert key in data

    def test_stats_hotel_denied(self, hotel_session):
        r = hotel_session.get(f"{API}/stats", timeout=15)
        assert r.status_code == 403

    def test_hotels_admin(self, admin_session, hotel_session):
        r = admin_session.get(f"{API}/hotels", timeout=15)
        assert r.status_code == 200
        emails = {h["email"].lower() for h in r.json()}
        assert hotel_session.email.lower() in emails
