# Kiểm thử PhotoBeo 3.0

## Tự động

Kết quả lần kiểm tra cuối ngày 18/11/2026: **24/24 unit/API tests**, **10/10 browser tests**, TypeScript và production build đều đạt. npm audit --omit=dev: **0 lỗ hổng được báo cáo**. Chưa có production deployment.

- npm test: unit filters/layouts và HTTP integration với server thật, SQLite và private filesystem object store.
- server/security.test.ts: ownership A/B, photoId giả, metadata giả, malformed image/MIME, CSRF/Origin, revision conflict, restart, idempotent registration và delete.
- server/storage.test.ts: expiry đúng createdAt+30 ngày, boundary trước/đúng hạn, cleanup/retry Storage lỗi, object độc lập Wall, signed URL expiry/tamper, recovery key sau cookie expiry, migration BLOB v2.
- npm run test:e2e: Chrome với webcam giả; 4 bước, Back/bổ sung/xóa/chụp lại, upload, các layout, pixel filter, Original, preset, consent không upload trước đồng ý, history refresh/download/delete, Wall giữ ảnh khi xóa history, recovery, kéo/xoay/resize/layer/undo/redo, save/reload/export và 390/820/1440 px.
- npm run build: TypeScript và Vite production bundle.

Ảnh kiểm tra nằm trong artifacts/v3-*.png. Dữ liệu test nằm trong .test-data, không dùng dữ liệu thư viện thật. Mã khôi phục trong ảnh chụp trang history được che.

## Giới hạn xác minh

Chưa có credentials/backend URL để kiểm thử private S3 bucket, production proxy, cloud scheduler, backup/restore cloud hoặc Docker thực tế. Chưa thử webcam vật lý, iOS Safari hoặc thiết bị Android thật; responsive là viewport Chrome. Browser Web Share file tùy hỗ trợ thiết bị, có fallback tải PNG.

npm audit ngày 18/11/2026 báo 5 mục high trong chuỗi công cụ development, cùng gốc advisory picomatch GHSA-fc5q-39xc-vjpf. Registry không có phiên bản 4.0.8 khi kiểm tra; không tự downgrade Vite/Vitest hoặc áp dụng force fix. Xem báo cáo npm audit trên môi trường deploy và cập nhật khi có bản vá tương thích. Đây là rủi ro dependency build/dev còn tồn tại, không phải tuyên bố đã xử lý hoàn toàn.

Không có commit, push hoặc production deployment trong lần nâng cấp.
