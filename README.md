# PhotoBeo 3.0

Photobooth pastel pink với luồng **Chụp ảnh → Chọn mẫu → Chỉnh sửa → Thành phẩm**, lịch sử riêng tư 30 ngày và Memory Wall lưu lâu dài.

## Chạy cục bộ

Yêu cầu Node.js 24+ và npm.

```powershell
cd D:\Prj\photobeo
npm.cmd ci
npm.cmd run dev
```

Mở http://localhost:5173. Backend Express chạy ở 127.0.0.1:3001, Vite proxy /api. Có thể sao chép .env.example thành .env; mặc định không cần dịch vụ cloud.

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd start
```

Sau build, npm start phục vụ cả frontend và API tại http://localhost:3001. npm run preview chỉ phục vụ frontend.

## Luồng sử dụng

1. **Chụp:** camera lớn, tải JPEG/PNG/WebP, countdown 0/3/5/10 giây hoặc tùy chỉnh, chụp liên tiếp, chuyển camera, lật gương, âm thanh, hiệu ứng; chụp lại/thay/xóa từng ảnh. Tối đa 6 ảnh.
2. **Chọn mẫu:** 1×3, 1×4, 2×2, 2×3, Polaroid; khung, họa tiết, màu, sticker, lời nhắn và ngày chụp. Thiếu ảnh có nút quay lại bổ sung; đổi mẫu không mất ảnh dự phòng.
3. **Chỉnh sửa:** 24 màu có thumbnail thật, 9 thanh chỉnh, Before/After, Original, preset cá nhân, áp dụng cả bộ. Ảnh gốc không bị ghi đè.
4. **Thành phẩm:** xem lớn, zoom/fullscreen, chia sẻ qua trình duyệt hỗ trợ, PNG HD cạnh dài 2400 px, đồng ý lưu lịch sử, thêm vào Wall hoặc chụp bộ mới.

Mỗi bước có progress và Back/Continue. Back giữ ảnh trong RAM; refresh trang chụp không giữ bản đang chỉnh chưa lưu. Preview khung và download dùng cùng renderer, cùng độ phân giải xử lý; thành phẩm sau lưu hiển thị chính PNG canonical trên máy chủ.

## Hai nơi lưu, hai vòng đời

| | Lịch sử /history | Memory Wall /memory-wall |
|---|---|---|
| Lúc lưu | Người dùng đồng ý gửi ảnh | Chủ động thêm ảnh đã xác thực |
| Thời hạn | createdAt + 30 × 24 giờ | Không có expiresAt |
| Tệp | temporary/<assetId>.png | permanent/<assetId>.png, bản sao độc lập |
| Xóa lịch sử | Xóa bản lịch sử | Bản sao Wall vẫn còn |
| Quyền riêng tư | Chỉ chủ sở hữu | Chỉ chủ sở hữu, không tự công khai |

Lịch sử có ngày hết hạn, tải HD và xóa trước hạn. Wall giữ ảnh, vị trí, kích thước, góc xoay, lớp, sticker/ghi chú/băng dính; Save, Load, Undo/Redo, Delete, Export PNG 3200×2400.

**Không tự gửi ảnh khi chụp/chỉnh.** Ảnh chỉ tới backend sau checkbox đồng ý và nút lưu. Backend kiểm tra ảnh nguồn, render PNG và cấp photoId. Khi dán lên Wall, backend kiểm tra quyền sở hữu và tạo object permanent riêng.

## Kiến trúc

- React 19, TypeScript, Vite, Canvas; Express 5 hiện có.
- SQLite metadata trên persistent disk, schema v3 và migration v2 tự động. Một instance ứng dụng.
- Object storage private: filesystem cục bộ hoặc S3-compatible qua AWS SDK; ảnh mới không lưu trong BLOB của database.
- Cookie HttpOnly/SameSite/HTTPS, CSRF + Origin, ownership trên mọi API. Signed image URLs 5 phút vẫn yêu cầu cookie của đúng chủ sở hữu.
- Tài khoản khách bền vững tách khỏi phiên đăng nhập 30 ngày. Trong Lịch sử, chủ động tạo/tải **mã khôi phục** để mở lại tài khoản sau khi mất/hết cookie. Đây là bearer secret, không phải đăng nhập email/Google; mã không được lưu localStorage. Chỉ hash mã lưu trong database.
- LocalStorage chỉ chứa công thức preset màu; ảnh chưa lưu nằm trong RAM.
- Cleanup mỗi phút và lúc khởi động; npm run cleanup cho scheduler/kiểm tra thủ công. Outbox lưu công việc xóa Storage để retry sau lỗi/restart. Hết hạn bị chặn truy cập đúng timestamp, việc xóa vật lý có thể trễ một chu kỳ hoặc trong lúc Storage lỗi.
- Hạn mức: 20 thành phẩm/giờ, 200 assets và 500 MiB/tài khoản (cả hai kho), 2 GiB toàn instance; tối đa 2 tác vụ render đồng thời.

Origin camera/upload chỉ mô tả luồng đăng ký; trình duyệt không chứng minh được ảnh đến từ webcam vật lý. Verified nghĩa là server đã xử lý và xác thực record/quyền sở hữu.

## Triển khai và kiểm thử

- [Audit trước khi sửa](docs/UPGRADE-3-AUDIT.md)
- [Migration, biến môi trường, scheduler, backup/recovery và triển khai](docs/DEPLOYMENT.md)
- [Mô hình bảo mật và vòng đời dữ liệu](docs/SECURITY.md)
- [Phạm vi kiểm thử và giới hạn](docs/VALIDATION-3.md)

Có adapter S3 nhưng chưa có credentials để xác minh bucket/cloud hoặc production. Không tự đăng ký dịch vụ, commit, push hay deploy. PostgreSQL được cân nhắc cho nhiều instance; bản này tận dụng SQLite đang có, không tạo backend trùng lặp.
