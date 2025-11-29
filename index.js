const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- CẤU HÌNH SWAGGER (Đã kiểm tra dấu phẩy) ---
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'UIT Booking API',
    version: '1.0.0',
    description: 'Tài liệu API hệ thống đặt phòng UIT',
  },
  servers: [
    { url: process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}` },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Đăng ký tài khoản',
        tags: ['Auth'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  fullName: { type: 'string' },
                  studentId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Đăng nhập',
        tags: ['Auth'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/auth/change-password': {
      post: {
        summary: 'Đổi mật khẩu',
        tags: ['Auth'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/profile': {
      get: {
        summary: 'Lấy thông tin cá nhân',
        tags: ['User'],
        responses: { 200: { description: 'OK' } }
      },
      patch: {
        summary: 'Cập nhật thông tin',
        tags: ['User'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string' },
                  phone: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/rooms': {
      get: {
        summary: 'Lấy danh sách phòng',
        tags: ['Booking'],
        security: [],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/bookings': {
      get: {
        summary: 'Lịch sử đặt phòng',
        tags: ['Booking'],
        responses: { 200: { description: 'OK' } }
      },
      post: {
        summary: 'Tạo booking mới',
        tags: ['Booking'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  room_id: { type: 'string' },
                  booking_date: { type: 'string' },
                  slot_start: { type: 'string' },
                  slot_end: { type: 'string' },
                  purpose: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/bookings/check': {
      get: {
        summary: 'Kiểm tra giờ bận',
        tags: ['Booking'],
        parameters: [
          { name: 'roomId', in: 'query', schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/bookings/{id}': {
      get: {
        summary: 'Xem chi tiết 1 booking',
        tags: ['Booking'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/bookings/{id}/cancel': {
      patch: {
        summary: 'Hủy đặt phòng',
        tags: ['Booking'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/bookings/{id}/checkin': {
      patch: {
        summary: 'Check-in (Quét QR)',
        tags: ['Booking'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/admin/stats': {
      get: {
        summary: 'Thống kê hệ thống',
        tags: ['Admin'],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/admin/bookings': {
      get: {
        summary: 'Xem tất cả booking',
        tags: ['Admin'],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/admin/bookings/{id}/{action}': {
      patch: {
        summary: 'Duyệt hoặc Từ chối',
        tags: ['Admin'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'action', in: 'path', required: true, schema: { type: 'string', enum: ['approve', 'reject'] } }
        ],
        responses: { 200: { description: 'OK' } }
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [], 
};

const specs = swaggerJsdoc(options);

// --- MIDDLEWARES ---
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// --- AUTH MIDDLEWARES ---
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
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Yêu cầu quyền Admin" });
  }
  next();
};

// --- API ROUTES ---

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, studentId } = req.body;
    const userExist = await db.query("SELECT * FROM profiles WHERE email = $1", [email]);
    if (userExist.rows.length > 0) return res.status(400).json({ error: "Email đã tồn tại" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      `INSERT INTO profiles (email, password, full_name, student_id, role) VALUES ($1, $2, $3, $4, 'student') RETURNING *`,
      [email, hashedPassword, fullName, studentId]
    );
    res.json({ message: "Đăng ký thành công!", user: newUser.rows[0] });
  } catch (err) { res.status(500).json({ error: "Lỗi server" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query("SELECT * FROM profiles WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Sai thông tin" });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Sai thông tin" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi", { expiresIn: "1d" });
    res.json({ message: "Thành công", token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) { res.status(500).json({ error: "Lỗi server" }); }
});

app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userResult = await db.query("SELECT password FROM profiles WHERE id = $1", [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!valid) return res.status(400).json({ error: "Mật khẩu cũ sai" });
    
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE profiles SET password = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ message: "Thành công" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const result = await db.query("SELECT id, email, full_name, student_id, phone, role FROM profiles WHERE id = $1", [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.patch("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    await db.query("UPDATE profiles SET full_name = $1, phone = $2 WHERE id = $3", [full_name, phone, req.user.id]);
    res.json({ message: "Cập nhật thành công" });
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
    const conflict = await db.query(
      `SELECT * FROM bookings WHERE room_id=$1 AND booking_date=$2 AND status NOT IN ('cancelled', 'rejected') AND (slot_start < $4 AND slot_end > $3)`,
      [room_id, booking_date, slot_start, slot_end]
    );
    if (conflict.rows.length > 0) return res.status(409).json({ error: "Đã trùng lịch" });

    const newBooking = await db.query(
      `INSERT INTO bookings (user_id, room_id, booking_date, slot_start, slot_end, purpose, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [req.user.id, room_id, booking_date, slot_start, slot_end, purpose, notes]
    );
    res.json({ message: "Thành công", booking: newBooking.rows[0] });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT b.*, r.name as room_name, r.type as room_type FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE b.user_id = $1 ORDER BY b.booking_date DESC`, [req.user.id]);
    const formatted = result.rows.map(row => ({
      id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end, status: row.status, purpose: row.purpose, room: { name: row.room_name, type: row.room_type }
    }));
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
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy" });
    
    const row = result.rows[0];
    const booking = {
      id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end, status: row.status, purpose: row.purpose,
      room: { name: row.room_name, type: row.room_type, image: row.image_url }, profile: { full_name: row.full_name, student_id: row.student_id, email: row.email }
    };
    res.json(booking);
  } catch (err) { res.status(500).json({ error: "Lỗi server" }); }
});

app.patch("/api/bookings/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2", [bookingId, req.user.id]);
    res.json({ message: "Đã hủy" });
  } catch (err) { res.status(500).json({ error: "Lỗi hủy" }); }
});

app.patch("/api/bookings/:id/checkin", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE bookings SET status = 'completed' WHERE id = $1", [id]);
    res.json({ message: "Check-in thành công!" });
  } catch (err) { res.status(500).json({ error: "Lỗi check-in" }); }
});

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
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.get("/api/admin/bookings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`SELECT b.*, r.name as room_name, r.type as room_type, p.full_name, p.email, p.student_id FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN profiles p ON b.user_id = p.id ORDER BY b.created_at DESC`);
    const formatted = result.rows.map(row => ({
      id: row.id, booking_date: row.booking_date, slot_start: row.slot_start, slot_end: row.slot_end, status: row.status, purpose: row.purpose, notes: row.notes,
      room: { name: row.room_name, type: row.room_type }, profile: { full_name: row.full_name, email: row.email, student_id: row.student_id }
    }));
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.patch("/api/admin/bookings/:id/:action", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;
    const status = action === 'approve' ? 'approved' : 'rejected';
    await db.query(`UPDATE bookings SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3`, [status, req.user.id, id]);
    res.json({ message: "Thành công" });
  } catch (err) { res.status(500).json({ error: "Lỗi" }); }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`📄 API Docs: http://localhost:${PORT}/api-docs`);
});