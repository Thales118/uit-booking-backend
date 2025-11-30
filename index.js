const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); // <--- Import file vừa tạo

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
  jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi", (err, user) => {
    if (err) return res.status(403).json({ error: "Token không hợp lệ" });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: "Cần quyền Admin" });
  next();
};

// --- ROUTES ---

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, studentId } = req.body;
    const userExist = await db.query("SELECT * FROM profiles WHERE email = $1", [email]);
    if (userExist.rows.length > 0) return res.status(400).json({ error: "Email đã tồn tại" });
    const hash = await bcrypt.hash(password, 10);
    const newUser = await db.query(`INSERT INTO profiles (email, password, full_name, student_id, role) VALUES ($1, $2, $3, $4, 'student') RETURNING *`, [email, hash, fullName, studentId]);
    res.json({ message: "OK", user: newUser.rows[0] });
  } catch (err) { res.status(500).json({ error: "Lỗi server" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query("SELECT * FROM profiles WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Sai thông tin" });
    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ error: "Sai thông tin" });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi", { expiresIn: "1d" });
    res.json({ message: "OK", token, user });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userResult = await db.query("SELECT password FROM profiles WHERE id = $1", [req.user.id]);
    if (!await bcrypt.compare(currentPassword, userResult.rows[0].password)) return res.status(400).json({ error: "Mật khẩu cũ sai" });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE profiles SET password = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ message: "OK" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM profiles WHERE id = $1", [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.patch("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    await db.query("UPDATE profiles SET full_name = $1, phone = $2 WHERE id = $3", [full_name, phone, req.user.id]);
    res.json({ message: "OK" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/rooms", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM rooms WHERE is_active = true ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.post("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const { room_id, booking_date, slot_start, slot_end, purpose, notes } = req.body;
    const conflict = await db.query(`SELECT * FROM bookings WHERE room_id=$1 AND booking_date=$2 AND status NOT IN ('cancelled','rejected') AND (slot_start < $4 AND slot_end > $3)`, [room_id, booking_date, slot_start, slot_end]);
    if (conflict.rows.length > 0) return res.status(409).json({ error: "Trùng lịch" });
    const newBooking = await db.query(`INSERT INTO bookings (user_id, room_id, booking_date, slot_start, slot_end, purpose, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`, [req.user.id, room_id, booking_date, slot_start, slot_end, purpose, notes]);
    res.json({ message: "OK", booking: newBooking.rows[0] });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT b.*, r.name as room_name, r.type as room_type FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE b.user_id = $1 ORDER BY b.booking_date DESC`, [req.user.id]);
    const formatted = result.rows.map(row => ({ id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end, status: row.status, purpose: row.purpose, room: { name: row.room_name, type: row.room_type } }));
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/bookings/check", async (req, res) => {
  try {
    const { roomId, date } = req.query;
    const result = await db.query("SELECT slot_start, slot_end, status FROM bookings WHERE room_id = $1 AND booking_date = $2 AND status IN ('pending', 'approved')", [roomId, date]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT b.*, r.name as room_name, r.type as room_type, r.image_url, p.full_name, p.student_id, p.email FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN profiles p ON b.user_id = p.id WHERE b.id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const row = result.rows[0];
    res.json({ id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end, status: row.status, purpose: row.purpose, room: { name: row.room_name, type: row.room_type, image: row.image_url }, profile: { full_name: row.full_name, student_id: row.student_id, email: row.email } });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.patch("/api/bookings/:id/cancel", authenticateToken, async (req, res) => {
  try {
    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ message: "OK" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.patch("/api/bookings/:id/checkin", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.query("UPDATE bookings SET status = 'completed' WHERE id = $1", [req.params.id]);
    res.json({ message: "OK" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalBookings = await db.query("SELECT COUNT(*) FROM bookings");
    const pendingCount = await db.query("SELECT COUNT(*) FROM bookings WHERE status = 'pending'");
    const totalUsers = await db.query("SELECT COUNT(*) FROM profiles WHERE role = 'student'");
    const activeRooms = await db.query("SELECT COUNT(*) FROM rooms WHERE is_active = true");
    res.json({ totalBookings: parseInt(totalBookings.rows[0].count), pendingCount: parseInt(pendingCount.rows[0].count), totalUsers: parseInt(totalUsers.rows[0].count), activeRooms: parseInt(activeRooms.rows[0].count) });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/admin/bookings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`SELECT b.*, r.name as room_name, r.type as room_type, p.full_name, p.email, p.student_id FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN profiles p ON b.user_id = p.id ORDER BY b.created_at DESC`);
    const formatted = result.rows.map(row => ({ id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end, status: row.status, purpose: row.purpose, notes: row.notes, room: { name: row.room_name, type: row.room_type }, profile: { full_name: row.full_name, email: row.email, student_id: row.student_id } }));
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.patch("/api/admin/bookings/:id/:action", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;
    const status = action === 'approve' ? 'approved' : 'rejected';
    await db.query(`UPDATE bookings SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3`, [status, req.user.id, id]);
    res.json({ message: "OK" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`📄 API Docs: http://localhost:${PORT}/api-docs`);
});