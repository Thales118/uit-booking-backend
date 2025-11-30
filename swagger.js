const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'UIT Booking API',
      version: '1.0.0',
      description: 'Tài liệu API hệ thống đặt phòng UIT',
    },
    servers: [
      { url: process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [], // Không quét file, dùng definition trực tiếp bên dưới
};

const swaggerSpec = swaggerJsdoc(options);

// Định nghĩa paths thủ công để tránh lỗi cú pháp
swaggerSpec.paths = {
  '/api/auth/register': {
    post: {
      summary: 'Đăng ký tài khoản',
      tags: ['Auth'],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { email: {type:'string'}, password:{type:'string'}, fullName:{type:'string'}, studentId:{type:'string'} } } } }
      },
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/auth/login': {
    post: {
      summary: 'Đăng nhập',
      tags: ['Auth'],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { email: {type:'string'}, password:{type:'string'} } } } }
      },
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/auth/change-password': {
    post: {
      summary: 'Đổi mật khẩu',
      tags: ['Auth'],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { currentPassword: {type:'string'}, newPassword:{type:'string'} } } } }
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
        content: { 'application/json': { schema: { type: 'object', properties: { full_name: {type:'string'}, phone:{type:'string'} } } } }
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
        content: { 'application/json': { schema: { type: 'object', properties: { room_id: {type:'string'}, booking_date:{type:'string'}, slot_start:{type:'string'}, slot_end:{type:'string'}, purpose:{type:'string'} } } } }
      },
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/bookings/check': {
    get: {
      summary: 'Check lịch trống',
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
      summary: 'Chi tiết booking (QR)',
      tags: ['Booking'],
      parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/bookings/{id}/cancel': {
    patch: {
      summary: 'Hủy đặt phòng',
      tags: ['Booking'],
      parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/bookings/{id}/checkin': {
    patch: {
      summary: 'Check-in (Admin)',
      tags: ['Booking'],
      parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/admin/stats': {
    get: {
      summary: 'Thống kê Admin',
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
      summary: 'Duyệt/Từ chối',
      tags: ['Admin'],
      parameters: [
        { name: 'id', in: 'path', schema: { type: 'string' } },
        { name: 'action', in: 'path', schema: { type: 'string' } }
      ],
      responses: { 200: { description: 'OK' } }
    }
  }
};

module.exports = swaggerSpec;