# PhotoBeo 3.0 — audit trước khi sửa

- Checkout: `D:\Prj\photobeo`, working tree sạch lúc bắt đầu nâng cấp 3.0; không commit/push.
- React 19 + Vite, Express 5, SQLite (Node 24), Sharp/Canvas. Tận dụng backend này, không tạo backend thứ hai.
- 2.0: toàn bộ camera/template/editor trên một màn hình; ảnh gốc giữ trong RAM; 24 bộ lọc dùng chung renderer.
- 2.0: ảnh PNG nằm trong SQLite BLOB, quyền sở hữu dựa trên cookie phiên 30 ngày; xóa phiên kéo theo ảnh và Wall. Chưa có lịch sử hết hạn độc lập.
- 3.0: wizard bốn bước; SQLite metadata có migration; private object store (filesystem cục bộ hoặc S3-compatible); ảnh lịch sử và bản sao Wall riêng; cleanup có outbox retry.
- Giữ tài khoản khách riêng tư với cookie HttpOnly và mã khôi phục bí mật do người dùng chủ động tạo. Không tự công khai hoặc gửi ảnh khi chưa đồng ý.
- PostgreSQL là đề xuất, chưa cần thay SQLite hiện có cho một instance. Production nhiều instance cần chuyển DB/khóa phân tán; không giả định có cloud credentials.
- Kiểm tra: unit, HTTP integration với thời gian giả lập, migration, browser workflow + desktop/tablet/mobile, build.
