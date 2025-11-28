const { Pool } = require("pg");
require("dotenv").config();

// Khởi tạo kết nối (Pool)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Sự kiện kiểm tra kết nối
pool.on("connect", () => {
  console.log("✅ Đã kết nối thành công tới Database PostgreSQL Local");
});

pool.on("error", (err) => {
  console.error("❌ Lỗi kết nối Database:", err);
  process.exit(-1);
});

// Export để dùng ở các file khác
module.exports = {
  query: (text, params) => pool.query(text, params),
};