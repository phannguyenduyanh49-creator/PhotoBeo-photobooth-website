# Bàn giao PhotoBeo 3.0

Checkout: `D:\Prj\photobeo`. Không commit, push hoặc deploy. Các tests dùng database tạm; chưa chạy migration lên thư viện `.data` thật của người dùng.

## Nhóm file thay đổi

| Nhóm | File |
|---|---|
| Wizard 4 bước | src/App.tsx, src/wizard.css, src/main.tsx |
| Template/preview/result | src/components/Settings.tsx, FramePreview.tsx, ResultViewer.tsx, Dialog.tsx; src/lib/layouts.ts, frameRenderer.ts |
| Lịch sử | src/pages/PhotoHistory.tsx |
| Memory Wall | src/pages/MemoryWall.tsx, src/components/wall/PhotoLibrary.tsx |
| API client và types | src/lib/api.ts, src/lib/wall.ts |
| API/auth/retention | server/app.ts, server/index.ts, server/schema.ts |
| Database migration | server/database.ts (schema v3, migration v2, indexes) |
| Private storage | server/storage.ts (filesystem + S3), server/config.ts |
| Cleanup job | server/maintenance.ts; npm run cleanup / migrate |
| Kiểm thử | server/security.test.ts, server/storage.test.ts; tests/photobooth.spec.ts, upgrade.spec.ts, history.spec.ts; playwright.config.ts |
| Dependencies/config | package.json, package-lock.json, .env.example, vercel.json, scripts/configure-vercel.mjs |
| Tài liệu | README.md; docs/UPGRADE-3-AUDIT.md, DEPLOYMENT.md, SECURITY.md, VALIDATION-3.md, DELIVERY-3.md |
| Ảnh QA | artifacts/v3-*.png; cập nhật các ảnh QA Wall/mobile/tablet/export hiện có |

## Migration và biến môi trường

Schema v3 chuyển metadata sang users/sessions/photo_sessions/photos/photo_assets/memory_walls/wall_items, có deletion_outbox và migration_blobs để xử lý lỗi I/O. Dữ liệu v2 trên Wall có bản sao permanent trước khi cleanup lịch sử hết hạn. Migration chạy tự động khi khởi động hoặc `npm run migrate`.

Biến mới: STORAGE_DRIVER, PHOTO_BEO_OBJECT_DIR, S3_BUCKET, S3_ENDPOINT, AWS_REGION và AWS credentials server-only. Tận dụng PHOTO_BEO_DATA_DIR, FRONTEND_ORIGIN, PORT, HOST, TRUST_PROXY hiện có. Xem .env.example và DEPLOYMENT.md.

## Chạy và triển khai

1. Local: `npm ci`, `npm run dev`, mở http://localhost:5173.
2. Nâng cấp dữ liệu thật: dừng bản cũ/scheduler, backup database + objects, cấu hình env, `npm run build`, `npm run migrate`, `npm start`.
3. Production cần Node 24 với persistent disk + HTTPS. Nếu S3: private bucket, server credentials, backup/versioning; test trước khi mở traffic.
4. Cleanup đã chạy mỗi phút trong server; có CLI để scheduler/monitor retry. Xem hướng dẫn backup/recovery và giữ bộ snapshot nhất quán.
5. Xác minh thực tế cookie, consent, upload, lịch sử, Wall, expiry/cleanup và restore trên hosting đã chọn trước khi tuyên bố production hoạt động.

24 unit/API tests và 10 browser tests đã qua, TypeScript/build đạt; xem VALIDATION-3.md. Dependencies production không có advisory được npm audit báo cáo; vẫn còn advisory picomatch trong công cụ dev/build. S3/cloud, Docker và thiết bị camera thật chưa được xác minh.
