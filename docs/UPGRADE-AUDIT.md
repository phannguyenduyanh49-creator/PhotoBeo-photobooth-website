# PhotoBeo 2.0 — audit và quyết định triển khai

## Trước nâng cấp

- React 19, TypeScript, Vite 6, Tailwind 4, Lucide; một trang App.tsx, state bằng React hooks. Không có routing/backend/database.
- useCamera quản lý getUserMedia, chọn thiết bị, facingMode, dừng tracks, chống yêu cầu trả về muộn. Giữ kiến trúc này.
- useCapture + countdown dùng AbortController, khóa phiên chụp và dọn timer. Giữ và bổ sung âm thanh/hiệu ứng tùy chọn.
- captureImage/readUpload đang bake filter vào JPEG; Photo chỉ có src/filterName. Không thể khôi phục ảnh gốc. Cần tách originalSrc/edit khỏi bản render.
- composeFrame và FramePreview dùng chung hình học, nhưng preview rất nhỏ. Thêm trình xem zoom/toàn màn hình và các hành động thành phẩm.
- Sáu filter dùng CSS/pixel với thumbnail minh họa. Chuyển sang 24 preset, pipeline pixel chung, thumbnail ảnh thật và preview camera bằng Canvas.
- 7 unit tests + 4 E2E hiện có. Mở rộng kiểm thử non-destructive editing, wall, ownership, giả mạo ID, CSRF, file lỗi và persistence.

## Phạm vi file

- Sửa App.tsx, PhotoTray, FramePreview, images, filters, layouts; giữ Settings, useCamera và countdown.
- Thêm editor, ResultViewer, router nhẹ, MemoryWall, WallCanvas, WallInspector, gallery, API client và history.
- Thêm shared frame renderer / wall schema dùng ở server và browser.
- Thêm server Node 24 + Express, SQLite, image validation/rendering; Vite API proxy và tài liệu deploy Vercel.

## Ranh giới tin cậy

- Phiên photobooth và chỉnh màu vẫn local. Chỉ nút lưu có bước đồng ý mới gửi ảnh gốc + công thức lên backend.
- Server kiểm tra byte ảnh, kích thước, kiểu file, tham số; tự render PNG. Không nhận thành phẩm tùy ý hoặc trạng thái verified từ frontend.
- photoId, assetId, ownerSessionId, createdAt, verificationStatus, version do server tạo. Wall chỉ tham chiếu record verified thuộc phiên HttpOnly hiện tại.
- Origin là loại luồng đăng ký do endpoint server gán (camera/upload), không phải chứng thực phần cứng. Trình duyệt không cung cấp bằng chứng mật mã rằng một bitmap thực sự đến từ webcam. Không quảng bá điều đó.
- SQLite lưu record, PNG dạng BLOB và bố cục riêng tư. Ảnh gốc chỉ xử lý tạm, không lưu. Không có bảng công khai, URL ảnh công khai hoặc tải file trực tiếp vào wall.
- Một bảng cho mỗi phiên ẩn danh; mất cookie/hết hạn thì không khôi phục truy cập. Production cần Node service với persistent disk, HTTPS và cùng-origin reverse proxy từ Vercel; không lưu SQLite vào filesystem serverless Vercel.

Không commit/push/deploy tự động trong lần nâng cấp này.
