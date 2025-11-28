const express = require("express");
const cors = require("cors"); 
const dotenv = require("dotenv");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); 
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization"); 

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Kiểm tra đăng nhập
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Bạn chưa đăng nhập" });

  jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi", (err, user) => {
    if (err) return res.status(403).json({ error: "Token không hợp lệ" });
    req.user = user;
    next();
  });
};

// Kiểm tra quyền Admin 
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Bạn không có quyền truy cập (Admin only)" });
  }
  next();
};

// --- 3. ROUTES CƠ BẢN ---

app.get("/", (req, res) => {
  res.send("Backend server is running correctly!");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ message: "Kết nối Database thành công!", time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi kết nối Database" });
  }
});

// --- 4. ROUTES AUTH (Đăng ký/Đăng nhập) ---

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, studentId } = req.body;
    const userExist = await db.query("SELECT * FROM profiles WHERE email = $1", [email]);
    if (userExist.rows.length > 0) return res.status(400).json({ error: "Email đã tồn tại" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      `INSERT INTO profiles (email, password, full_name, student_id, role) 
       VALUES ($1, $2, $3, $4, 'student') RETURNING *`,
      [email, hashedPassword, fullName, studentId]
    );
    res.json({ message: "Đăng ký thành công!", user: newUser.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query("SELECT * FROM profiles WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Sai email hoặc mật khẩu" });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Sai email hoặc mật khẩu" });

    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi", 
      { expiresIn: "1d" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// API: Đổi mật khẩu
app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Vui lòng nhập đủ thông tin" });
    }

    // 1. Lấy mật khẩu đã mã hóa hiện tại trong DB
    const userResult = await db.query("SELECT password FROM profiles WHERE id = $1", [user_id]);
    const user = userResult.rows[0];

    // 2. Kiểm tra mật khẩu cũ có đúng không
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    // 3. Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // 4. Cập nhật vào Database
    await db.query("UPDATE profiles SET password = $1 WHERE id = $2", [hashedNewPassword, user_id]);

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi đổi mật khẩu" });
  }
});

// --- 5. ROUTES DỮ LIỆU (Phòng & Đặt phòng) ---

app.get("/api/rooms", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM rooms WHERE is_active = true ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách phòng" });
  }
});

// API: Đặt phòng mới 
app.post("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const { room_id, booking_date, slot_start, slot_end, purpose, notes } = req.body;
    const user_id = req.user.id; 

    // Kiểm tra dữ liệu đầu vào
    if (!room_id || !booking_date || !slot_start || !slot_end || !purpose) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    //KIỂM TRA TRÙNG LỊCH 
    
    // Logic: Tìm xem có booking nào trong DB thỏa mãn:
    // 1. Cùng phòng, cùng ngày
    // 2. Trạng thái KHÔNG PHẢI là cancelled hoặc rejected
    // 3. Thời gian đè lên nhau
    const conflictCheck = await db.query(
      `SELECT * FROM bookings 
       WHERE room_id = $1 
       AND booking_date = $2
       AND status NOT IN ('cancelled', 'rejected')
       AND (slot_start < $4 AND slot_end > $3)`,
      [room_id, booking_date, slot_start, slot_end]
    );

    // Nếu tìm thấy ít nhất 1 dòng -> Có người đặt rồi -> Báo lỗi ngay
    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: "Phòng này đã kín trong khung giờ bạn chọn! Vui lòng chọn giờ khác." 
      });
    }

    // Nếu không trùng thì mới Insert vào Database
    const newBooking = await db.query(
      `INSERT INTO bookings (user_id, room_id, booking_date, slot_start, slot_end, purpose, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [user_id, room_id, booking_date, slot_start, slot_end, purpose, notes]
    );

    res.json({ message: "Đặt phòng thành công!", booking: newBooking.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi đặt phòng" });
  }
});

app.get("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await db.query(`
      SELECT b.*, r.name as room_name, r.type as room_type 
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.user_id = $1
      ORDER BY b.booking_date DESC
    `, [user_id]);
    
    const formatted = result.rows.map(row => ({
      id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end,
      status: row.status, purpose: row.purpose, notes: row.notes, qr_code: row.qr_code,
      room: { name: row.room_name, type: row.room_type }
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy lịch sử" });
  }
});

app.patch("/api/bookings/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const user_id = req.user.id;
    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2", [bookingId, user_id]);
    res.json({ message: "Đã hủy" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hủy" });
  }
});

// --- 6. ROUTES ADMIN ---
// 👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇

// Lấy danh sách Booking (Admin)
app.get("/api/admin/bookings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.*, r.name as room_name, r.type as room_type,
             p.full_name, p.email, p.student_id
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN profiles p ON b.user_id = p.id
      ORDER BY b.created_at DESC
    `);

    const formatted = result.rows.map(row => ({
      id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end,
      status: row.status, purpose: row.purpose, notes: row.notes,
      room: { name: row.room_name, type: row.room_type },
      profile: { full_name: row.full_name, email: row.email, student_id: row.student_id }
    }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi Admin Bookings" });
  }
});

// Lấy thống kê (Admin)
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalBookings = await db.query("SELECT COUNT(*) FROM bookings");
    const pendingCount = await db.query("SELECT COUNT(*) FROM bookings WHERE status = 'pending'");
    const totalUsers = await db.query("SELECT COUNT(*) FROM profiles WHERE role = 'student'");
    const activeRooms = await db.query("SELECT COUNT(*) FROM rooms WHERE is_active = true");

    res.json({
      totalBookings: parseInt(totalBookings.rows[0].count),
      pendingCount: parseInt(pendingCount.rows[0].count),
      totalUsers: parseInt(totalUsers.rows[0].count),
      activeRooms: parseInt(activeRooms.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi Stats" });
  }
});

// Duyệt / Từ chối
app.patch("/api/admin/bookings/:id/:action", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;
    const status = action === 'approve' ? 'approved' : 'rejected';
    const adminId = req.user.id;
    
    // Nếu là approve thì tạo QR code (giả lập bằng booking ID)
    const qr_code = action === 'approve' ? id : null;

    await db.query(`
      UPDATE bookings 
      SET status = $1, approved_by = $2, approved_at = NOW(), qr_code = $3
      WHERE id = $4
    `, [status, adminId, qr_code, id]);

    res.json({ message: "Thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi duyệt" });
  }
});

// --- KHU VỰC PROFILE (Thông tin cá nhân) ---

// 1. Lấy thông tin cá nhân chi tiết
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await db.query("SELECT id, email, full_name, student_id, phone, role, avatar_url FROM profiles WHERE id = $1", [user_id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy user" });
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi lấy thông tin profile" });
  }
});

// 2. Cập nhật thông tin (Tên, SĐT)
app.patch("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { full_name, phone } = req.body;

    const result = await db.query(
      `UPDATE profiles 
       SET full_name = $1, phone = $2 
       WHERE id = $3 
       RETURNING id, email, full_name, student_id, phone, role`,
      [full_name, phone, user_id]
    );

    res.json({ message: "Cập nhật thành công", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi cập nhật profile" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});