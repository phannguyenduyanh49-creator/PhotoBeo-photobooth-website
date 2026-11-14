# PhotoBeo 2.0

Photobooth tiếng Việt phong cách pastel với camera thật, chỉnh màu không phá hủy ảnh gốc và **Góc kỷ niệm** riêng tư tại `/memory-wall`.

React 19 + TypeScript + Vite + Tailwind + Lucide được giữ lại. Backend mới dùng Node 24, Express, SQLite, Sharp và Canvas để kiểm tra ảnh, tự ghép thành phẩm và xác thực quyền sử dụng.

## Chạy local

Cài **Node.js 24+**, rồi chạy tại thư mục dự án:

```powershell
cd D:\Prj\photobeo
npm.cmd ci
npm.cmd run dev
```

- Frontend: http://localhost:5173
- Góc kỷ niệm: http://localhost:5173/memory-wall
- Backend: http://127.0.0.1:3001 (frontend dùng proxy `/api`)
- Dữ liệu thật local: `.data/photobeo.sqlite`. Không xóa nếu muốn giữ thư viện.
- Không bắt buộc có `.env` để chạy local. Dùng `.env.example` nếu cần đổi cấu hình.
- Trên macOS/Linux dùng `npm`; trên PowerShell dùng `npm.cmd` nếu chính sách chặn `npm.ps1`.

Camera cần HTTPS hoặc localhost. Camera trên điện thoại truy cập địa chỉ IP LAN qua HTTP có thể bị chặn; vẫn có thể tải ảnh từ thiết bị.

## Photobooth và chỉnh màu

- 5 bố cục: dải 1×3, dải 1×4, lưới 2×2, lưới 2×3, Polaroid.
- 5 kiểu khung, màu tùy chọn, lời nhắn 50 ký tự, bật/tắt ngày.
- Bật/tắt camera, chọn thiết bị, trước/sau, lật gương đồng nhất với ảnh chụp.
- Chụp từng ảnh/tự động, đếm ngược 0/3/5/10 hoặc 1–15 giây; hủy, chụp lại từng ô/cả bộ.
- JPEG, PNG, WebP tối đa 15 MB/60 MP ở client, chuẩn hóa 1600×1200, crop cover không kéo méo.
- **24 preset** thuộc Cơ bản, Pastel, Film, Sáng tạo, thumbnail từ cùng ảnh thật. Khi có ảnh/camera, dùng preview phù hợp.
- 10 điều chỉnh: độ sáng, tương phản, độ bão hòa, độ ấm, tint, vùng sáng, vùng tối, hạt phim, tối góc, cường độ bộ lọc.
- Chọn ảnh đã chụp/tải lên để chỉnh lại. Có Trước/Sau, khôi phục Original, áp dụng cả bộ và lưu preset cá nhân trên trình duyệt.
- `originalSrc` và `EditRecipe` được giữ riêng. Mọi lần chỉnh đều render lại từ gốc; không chồng bộ lọc vào JPEG đã chỉnh.
- Preview camera, thumbnail, PNG và backend dùng chung pipeline pixel. Preview kích thước nhỏ được lấy mẫu để tiết kiệm CPU; preview thành phẩm và file tải dùng cùng PNG.
- Flash/âm thanh shutter tùy chọn, ảnh vào danh sách, hiệu ứng lên màu và trái tim hoàn thành; có nút tắt hiệu ứng và hỗ trợ reduced motion.
- Thành phẩm lớn hơn, click xem lớn, zoom, toàn màn hình, tải HD, chia sẻ bằng Web Share nếu trình duyệt hỗ trợ.
- PNG có cạnh dài 2400 px; tên `PhotoBeo-YYYYMMDD-HHmmss.png`.

Đổi bố cục giữ ảnh dư trong phiên, xuất lại theo bố cục đang chọn. Phiên chụp và ảnh gốc vẫn ở bộ nhớ trình duyệt: reload/đóng trang sẽ mất phiên chưa lưu. Preset cá nhân chỉ chứa thông số màu, không chứa ảnh và không có giá trị xác thực.

## Góc kỷ niệm

1. Hoàn thành một bộ ảnh trong photobooth.
2. Chọn **Thêm vào Creative Wall**.
3. Đọc thông báo và tích đồng ý gửi ảnh/thiết lập để server xử lý và lưu thành phẩm riêng tư.
4. Server kiểm tra nguồn ảnh, tự render PNG, tạo record verified thuộc phiên hiện tại.
5. Mở **Góc kỷ niệm**, dán ảnh từ thư viện, kéo vị trí, xoay, đổi kích thước giữ tỷ lệ và xếp lớp.
6. Thêm sticker, ghi chú, băng dính; Undo/Redo (Ctrl/Cmd+Z, Shift+Z hoặc Ctrl/Cmd+Y).
7. **Lưu bảng** để lưu bố cục. **Xuất PNG** xác thực/lưu bố cục trước, rồi xuất trang giấy 3200×2400 px.

Chọn đối tượng rồi dùng các tay nắm hoặc bảng chỉnh bên phải. Có thể dùng phím mũi tên để di chuyển, giữ Shift để bước lớn hơn. Trên màn hình nhỏ, trang giấy có vùng cuộn riêng và zoom.

Mỗi phiên có một bảng riêng tư; không có bảng công khai hoặc URL chia sẻ ảnh công khai. Không nhận ảnh kéo trực tiếp từ máy vào wall. Ảnh upload phải đi qua photobooth và đăng ký thành phẩm.

Lưu revision ngăn tab cũ ghi đè bản mới. Nếu có xung đột, tải bản đã lưu và sửa tiếp. Xóa một đối tượng chỉ gỡ khỏi trang giấy; xóa ảnh trong thư viện hoặc xóa cả phiên là thao tác riêng có xác nhận.

## Lưu trữ, quyền riêng tư và xác thực

SQLite chứa phiên, record ảnh, PNG BLOB và bố cục. Ảnh gốc chỉ xử lý tạm trong bộ nhớ của request; không lưu trên server. Browser không tự gửi ảnh nếu chưa tích đồng ý lưu.

Record gồm `photoId`, `createdAt`, `origin`, `assetId`, `ownerSessionId`, `verificationStatus`, `photoBeoVersion`; ID, owner, trạng thái verified, ngày và version đều do server tạo. API không tin metadata xác thực client tự gửi.

Token phiên 256 bit nằm trong cookie HttpOnly, SameSite=Strict; production dùng Secure và prefix `__Host-`. Server kiểm tra quyền trên mỗi lần đọc ảnh hoặc lưu bảng, kiểm tra Origin và CSRF token cho thao tác ghi. Có giới hạn file/body/pixel, rate limit, quota, kiểm tra byte ảnh và loại bỏ metadata.

**“Đã xác thực” nghĩa là thành phẩm được server PhotoBeo kiểm tra/render/đăng ký và thuộc phiên hiện tại.** Nó không chứng thực tác giả hay nguồn webcam vật lý. Origin mô tả luồng đăng ký camera/upload, không phải bằng chứng phần cứng. Watermark không có giá trị xác thực.

Phiên ẩn danh có thời hạn **30 ngày**. Mất cookie/hết hạn sẽ không khôi phục quyền truy cập ở bản này; hãy tải PNG để giữ lâu dài. Dữ liệu hết hạn được dọn khi khởi động và mỗi giờ. Có thể xóa ảnh hoặc toàn bộ dữ liệu phiên trong giao diện.

Chi tiết: [Mô hình bảo mật](docs/SECURITY.md).

## Kiểm tra

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

- Unit/integration: hình học/crop, countdown cancellation, tệp ảnh, 24 preset, chỉnh màu từ gốc, giới hạn wall; backend thật với SQLite và hai phiên độc lập.
- Security: ID giả/khác owner, forged metadata, CSRF/Origin, MIME giả/tệp hỏng, revision conflict, persistence sau restart, retry idempotent, xóa record/asset.
- E2E: Chrome với camera giả, 5 bố cục, đổi filter, upload, xuất/tải PNG, mobile/tablet, đồng ý lưu, kéo/xoay/resize/layer/undo/redo, save/reload/export wall, từ chối file trực tiếp và backend lỗi.
- E2E dùng data directory riêng dưới `.test-data`, không ghi vào thư viện local thường dùng.
- Ảnh QA/PNG thử: `artifacts/`; trace lỗi: `test-results/`.
- Chrome cần được cài sẵn. Có thể đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge.

Cần kiểm tra thêm webcam thật, camera trước/sau trên điện thoại, Safari iOS và bảng chia sẻ hệ điều hành. Các bài tự động không thay thế kiểm thử phần cứng thật.

## Deploy

Frontend vẫn deploy Vercel được. Backend cần Node 24 với **persistent disk**, HTTPS và cấu hình origin; không đặt SQLite trong filesystem tạm của Vercel Functions.

Bàn giao có `vercel.json` cho route SPA, script cấu hình API proxy và Dockerfile tùy chọn. Chưa có URL backend production nên chưa cấu hình proxy/deploy thật.

Xem [hướng dẫn local và deploy](docs/DEPLOYMENT.md). Không có secret hardcode trong frontend.

## Cấu trúc chính

```text
src/
  App.tsx                       Điều phối photobooth và route
  components/editor/            Bộ lọc, thumbnail ảnh thật, camera preview pixel
  components/ResultViewer.tsx   Zoom, full screen, HD, share, đồng ý lưu
  components/wall/              Canvas, thư viện và bảng chỉnh đối tượng
  pages/MemoryWall.tsx           Luồng scrapbook riêng tư
  hooks/                        Camera, countdown, shutter, route, history
  lib/filters.ts                24 preset và pipeline pixel chung
  lib/frameRenderer.ts          Hình học/khung dùng ở browser và server
  lib/wall.ts                   Đối tượng và renderer wall chung
  lib/api.ts                    Cookie session, CSRF và API client
server/
  app.ts                        Sessions, ownership, quota, SQLite, routes
  schema.ts                     Validation strict
  render.ts                     Decode/re-encode và render PNG canonical
  security.test.ts              Kiểm tra server với hai phiên độc lập
scripts/
  dev.mjs                       Chạy frontend + backend
  configure-vercel.mjs           Sinh reverse proxy từ backend URL thật
```

Audit ban đầu: [UPGRADE-AUDIT.md](docs/UPGRADE-AUDIT.md). Ảnh mẫu bộ lọc: Amelia Cui / Unsplash, nguồn và giấy phép tại [ASSET-CREDITS.md](public/ASSET-CREDITS.md). Font được đóng gói local.

