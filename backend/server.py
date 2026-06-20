from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated
from io import StringIO
import csv

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict

# ----- MongoDB -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# ----- Helpers -----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def PyObjectId():
    return Annotated[str, BeforeValidator(lambda v: str(v) if v else v)]


# ----- Models -----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    hotel_name: str = Field(min_length=2)
    phone: Optional[str] = None
    address: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    hotel_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class ItemIn(BaseModel):
    name: str = Field(min_length=1)
    category: str = Field(default="vegetable")  # vegetable | fruit
    unit: str = Field(default="kg")
    icon: Optional[str] = None

class ItemOut(BaseModel):
    id: str
    name: str
    category: str
    unit: str
    icon: Optional[str] = None

class OrderLine(BaseModel):
    item_id: str
    name: str
    unit: str
    category: str
    quantity: float

class OrderIn(BaseModel):
    order_date: str  # YYYY-MM-DD
    notes: Optional[str] = None
    lines: List[OrderLine]

class OrderOut(BaseModel):
    id: str
    hotel_id: str
    hotel_name: str
    order_date: str
    notes: Optional[str] = None
    status: str
    created_at: str
    lines: List[OrderLine]


# ----- App -----
app = FastAPI(title="Green Groceries API")
api = APIRouter(prefix="/api")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def set_auth_cookies(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=False, samesite="lax", max_age=86400, path="/",
    )


def user_to_out(user: dict) -> dict:
    return {
        "id": user.get("id") or str(user.get("_id")),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "hotel_name": user.get("hotel_name"),
        "phone": user.get("phone"),
        "address": user.get("address"),
    }


# ----- Auth endpoints -----
# Public registration is disabled — hotels are created by admin.

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    token = create_access_token(user_id, email, user["role"])
    set_auth_cookies(response, token)
    user["id"] = user_id
    return {"user": user_to_out(user), "access_token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


# ----- Items -----
@api.get("/items", response_model=List[ItemOut])
async def list_items(user: dict = Depends(get_current_user)):
    docs = await db.items.find({}).sort("name", 1).to_list(1000)
    return [{"id": str(d["_id"]), "name": d["name"], "category": d["category"],
             "unit": d["unit"], "icon": d.get("icon")} for d in docs]


@api.post("/items", response_model=ItemOut)
async def create_item(payload: ItemIn, _: dict = Depends(require_admin)):
    existing = await db.items.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Item with this name already exists")
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.items.insert_one(doc)
    return {"id": str(result.inserted_id), **payload.model_dump()}


@api.put("/items/{item_id}", response_model=ItemOut)
async def update_item(item_id: str, payload: ItemIn, _: dict = Depends(require_admin)):
    await db.items.update_one({"_id": ObjectId(item_id)}, {"$set": payload.model_dump()})
    doc = await db.items.find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"id": str(doc["_id"]), "name": doc["name"], "category": doc["category"],
            "unit": doc["unit"], "icon": doc.get("icon")}


@api.delete("/items/{item_id}")
async def delete_item(item_id: str, _: dict = Depends(require_admin)):
    result = await db.items.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ----- Orders -----
@api.post("/orders", response_model=OrderOut)
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if user["role"] != "hotel":
        raise HTTPException(status_code=403, detail="Only hotels can place orders")
    if not payload.lines:
        raise HTTPException(status_code=400, detail="At least one item required")
    # Filter out zero-quantity lines
    valid_lines = [ln for ln in payload.lines if ln.quantity > 0]
    if not valid_lines:
        raise HTTPException(status_code=400, detail="Add quantity for at least one item")
    doc = {
        "hotel_id": user["id"],
        "hotel_name": user.get("hotel_name") or user["name"],
        "order_date": payload.order_date,
        "notes": payload.notes,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "lines": [ln.model_dump() for ln in valid_lines],
    }
    result = await db.orders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@api.get("/orders", response_model=List[OrderOut])
async def list_orders(
    user: dict = Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
):
    query: dict = {}
    if user["role"] == "hotel":
        query["hotel_id"] = user["id"]
    if date_from and date_to:
        query["order_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["order_date"] = {"$gte": date_from}
    elif date_to:
        query["order_date"] = {"$lte": date_to}
    if status:
        query["status"] = status
    docs = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        out.append({
            "id": str(d["_id"]), "hotel_id": d["hotel_id"], "hotel_name": d["hotel_name"],
            "order_date": d["order_date"], "notes": d.get("notes"), "status": d["status"],
            "created_at": d["created_at"], "lines": d["lines"],
        })
    return out


@api.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: dict, user: dict = Depends(get_current_user)):
    new_status = body.get("status")
    if new_status not in {"pending", "delivered", "cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    # Hotels may only cancel their own pending orders. Admin may set any status.
    if user["role"] == "hotel":
        if new_status != "cancelled":
            raise HTTPException(status_code=403, detail="Hotels can only cancel orders")
        existing = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Order not found")
        if existing["hotel_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your order")
        if existing["status"] != "pending":
            raise HTTPException(status_code=400, detail="Only pending orders can be cancelled")

    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)}, {"$set": {"status": new_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True, "status": new_status}


@api.delete("/orders/{order_id}")
async def delete_order(order_id: str, _: dict = Depends(require_admin)):
    # Hard delete is admin-only. Hotels should use PATCH /status cancelled to preserve history.
    result = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


# ----- Purchase Sheet -----
@api.get("/purchase-sheet")
async def purchase_sheet(
    date_from: str,
    date_to: Optional[str] = None,
    _: dict = Depends(require_admin),
):
    if not date_to:
        date_to = date_from
    docs = await db.orders.find(
        {"order_date": {"$gte": date_from, "$lte": date_to}, "status": {"$ne": "cancelled"}}
    ).to_list(5000)

    agg: dict = {}
    hotels: set = set()
    total_orders = 0
    for d in docs:
        total_orders += 1
        hotels.add(d["hotel_id"])
        for ln in d["lines"]:
            key = ln["name"]
            if key not in agg:
                agg[key] = {
                    "name": ln["name"], "category": ln["category"],
                    "unit": ln["unit"], "total_quantity": 0.0, "hotel_count": set(),
                }
            agg[key]["total_quantity"] += float(ln["quantity"])
            agg[key]["hotel_count"].add(d["hotel_id"])

    rows = []
    for v in agg.values():
        rows.append({
            "name": v["name"], "category": v["category"], "unit": v["unit"],
            "total_quantity": round(v["total_quantity"], 2),
            "hotel_count": len(v["hotel_count"]),
        })
    rows.sort(key=lambda r: (r["category"], r["name"]))

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_orders": total_orders,
        "total_hotels": len(hotels),
        "rows": rows,
    }


@api.get("/purchase-sheet/export")
async def export_purchase_sheet(
    date_from: str,
    date_to: Optional[str] = None,
    _: dict = Depends(require_admin),
):
    sheet = await purchase_sheet(date_from=date_from, date_to=date_to, _=_)
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Green Groceries - Combined Purchase Sheet"])
    writer.writerow([f"From: {sheet['date_from']}", f"To: {sheet['date_to']}"])
    writer.writerow([f"Hotels: {sheet['total_hotels']}", f"Orders: {sheet['total_orders']}"])
    writer.writerow([])
    writer.writerow(["Item", "Category", "Unit", "Total Quantity", "Hotels Ordered"])
    for r in sheet["rows"]:
        writer.writerow([r["name"], r["category"], r["unit"], r["total_quantity"], r["hotel_count"]])
    buf.seek(0)
    filename = f"purchase_sheet_{sheet['date_from']}_to_{sheet['date_to']}.csv"
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----- Stats -----
@api.get("/stats")
async def stats(_: dict = Depends(require_admin)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_hotels = await db.users.count_documents({"role": "hotel"})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    today_orders_docs = await db.orders.find({"order_date": today}).to_list(2000)
    total_qty_today = 0.0
    for d in today_orders_docs:
        for ln in d["lines"]:
            total_qty_today += float(ln["quantity"])
    total_orders = await db.orders.count_documents({})
    return {
        "total_hotels": total_hotels,
        "pending_orders": pending_orders,
        "total_orders": total_orders,
        "today_total_quantity": round(total_qty_today, 2),
        "today_orders_count": len(today_orders_docs),
    }


# ----- Hotels (admin only) -----
class HotelCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    hotel_name: str = Field(min_length=2)
    phone: Optional[str] = None
    address: Optional[str] = None


class HotelPasswordIn(BaseModel):
    password: str = Field(min_length=6)


@api.post("/hotels")
async def create_hotel(payload: HotelCreateIn, _: dict = Depends(require_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": "hotel",
        "hotel_name": payload.hotel_name,
        "phone": payload.phone,
        "address": payload.address,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "email": email,
        "name": payload.name,
        "hotel_name": payload.hotel_name,
        "phone": payload.phone,
        "address": payload.address,
    }


@api.patch("/hotels/{hotel_id}/password")
async def reset_hotel_password(hotel_id: str, payload: HotelPasswordIn, _: dict = Depends(require_admin)):
    hotel = await db.users.find_one({"_id": ObjectId(hotel_id), "role": "hotel"})
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    await db.users.update_one(
        {"_id": ObjectId(hotel_id)},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    return {"ok": True}


@api.delete("/hotels/{hotel_id}")
async def delete_hotel(hotel_id: str, _: dict = Depends(require_admin)):
    result = await db.users.delete_one({"_id": ObjectId(hotel_id), "role": "hotel"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return {"ok": True}


@api.get("/hotels")
async def list_hotels(_: dict = Depends(require_admin)):
    docs = await db.users.find({"role": "hotel"}).sort("hotel_name", 1).to_list(1000)
    return [{
        "id": str(d["_id"]), "name": d["name"], "email": d["email"],
        "hotel_name": d.get("hotel_name"), "phone": d.get("phone"),
        "address": d.get("address"),
    } for d in docs]


app.include_router(api)

origins_env = os.environ.get("CORS_ORIGINS", "*")
allow_origins = ["*"] if origins_env == "*" else origins_env.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.items.create_index("name", unique=True)
    await db.orders.create_index([("order_date", 1)])
    await db.orders.create_index([("hotel_id", 1)])

    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Updated admin password hash")

    # Seed default catalog
    if await db.items.count_documents({}) == 0:
        default_items = [
            {"name": "Potato", "category": "vegetable", "unit": "kg", "icon": "🥔"},
            {"name": "Onion", "category": "vegetable", "unit": "kg", "icon": "🧅"},
            {"name": "Tomato", "category": "vegetable", "unit": "kg", "icon": "🍅"},
            {"name": "Garlic", "category": "vegetable", "unit": "kg", "icon": "🧄"},
            {"name": "Carrot", "category": "vegetable", "unit": "kg", "icon": "🥕"},
            {"name": "Capsicum", "category": "vegetable", "unit": "kg", "icon": "🫑"},
            {"name": "Apple", "category": "fruit", "unit": "kg", "icon": "🍎"},
            {"name": "Banana", "category": "fruit", "unit": "dozen", "icon": "🍌"},
            {"name": "Orange", "category": "fruit", "unit": "kg", "icon": "🍊"},
            {"name": "Papaya", "category": "fruit", "unit": "kg", "icon": "🍈"},
        ]
        for it in default_items:
            it["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.items.insert_many(default_items)
        logger.info("Seeded default catalog items")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
