# ⚙️ UIT Campus Booking System - Backend API

Đây là Server xử lý logic (Server-side) cho hệ thống đặt phòng UIT. Dự án cung cấp RESTful API, xử lý xác thực, phân quyền và kết nối cơ sở dữ liệu.

## 🚀 Công nghệ sử dụng

* **Runtime:** Node.js.
* **Framework:** Express.js.
* **Database:** PostgreSQL.
* **Authentication:** JWT (JSON Web Token), Bcryptjs (Mã hóa mật khẩu).
* **Driver:** pg (node-postgres).
* **Security:** CORS middleware.

## 🗄️ Cấu trúc Database (Schema)

Hệ thống sử dụng PostgreSQL với các bảng chính:
* `profiles`: Lưu thông tin người dùng và phân quyền (student/admin).
* `rooms`: Lưu thông tin phòng học, sân bãi.
* `bookings`: Lưu thông tin đặt phòng, trạng thái duyệt.

## 🛠️ Hướng dẫn cài đặt và chạy

### 1. Yêu cầu tiên quyết
* Node.js (v18+).
* PostgreSQL (đã cài đặt và chạy trên máy).

### 2. Cài đặt

# Clone dự án
git clone <LINK_GITHUB_BACKEND_CUA_BAN>
cd uit-booking-backend

# Cài đặt thư viện
npm install

### 3. Cấu hình môi trường (.env)

Tạo một file tên là `.env` trong thư mục gốc và điền thông tin sau:

PORT=5000
DATABASE_URL="postgres://postgres:123456@localhost:5432/uit_booking_db"
JWT_SECRET="bi_mat_khong_the_bat_mi"

*(Lưu ý: Thay `123456` bằng mật khẩu PostgreSQL của bạn)*

### 4. Khởi tạo Database

Chạy câu lệnh SQL sau trong pgAdmin để tạo bảng:

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    full_name TEXT,
    student_id TEXT,
    phone TEXT,
    role TEXT DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    room_id UUID REFERENCES rooms(id),
    booking_date DATE NOT NULL,
    slot_start TIME NOT NULL,
    slot_end TIME NOT NULL,
    purpose TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    qr_code TEXT,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

### 5. Chạy Server

# Chạy server development
npm run dev

Server sẽ khởi động tại `http://localhost:5000`.

## 📡 Danh sách API (Endpoints)

| Method | Endpoint | Mô tả | Yêu cầu Auth |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Đăng ký tài khoản | Không |
| **POST** | `/api/auth/login` | Đăng nhập | Không |
| **GET** | `/api/profile` | Lấy thông tin cá nhân | Token |
| **PATCH** | `/api/profile` | Cập nhật thông tin | Token |
| **GET** | `/api/rooms` | Lấy danh sách phòng | Không |
| **POST** | `/api/bookings` | Đặt phòng mới | Token |
| **GET** | `/api/bookings` | Lịch sử đặt phòng | Token |
| **GET** | `/api/admin/bookings` | Admin xem tất cả yêu cầu | Admin Token |
| **PATCH** | `/api/admin/bookings/:id/:action` | Duyệt/Từ chối phòng | Admin Token |