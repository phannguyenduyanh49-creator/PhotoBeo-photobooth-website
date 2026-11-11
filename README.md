# PhotoBeo

Photobooth tiếng Việt với React, TypeScript, Vite, Tailwind CSS và Lucide Icons. Toàn bộ ảnh được xử lý tại trình duyệt; không có backend, tài khoản hay dịch vụ nhận ảnh. Font Nunito và Dancing Script được đóng gói cùng ứng dụng, không gọi Google Fonts.

## Chạy trên máy

Yêu cầu Node.js 22.12+ hoặc Node.js 24, npm và trình duyệt hiện đại.

```powershell
cd D:\Prj\photobeo
npm.cmd install
npm.cmd run dev
```

Mở địa chỉ Vite in ra, mặc định `http://localhost:5173`. Dùng `npm.cmd` trên PowerShell nếu máy chặn script `npm.ps1`; trên macOS/Linux có thể dùng `npm` như bình thường. Sau khi có `package-lock.json`, dùng `npm ci` để cài đúng các phiên bản đã khóa.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`dist/` là bản production, có thể phục vụ trên static hosting có HTTPS. Không mở trực tiếp `index.html` bằng `file://`.

## Sử dụng

1. Chọn dải 1×3, dải 1×4, lưới 2×2, lưới 2×3 hoặc Polaroid.
2. Chọn khung hồng pastel, tối giản, trái tim, nơ hoặc retro. Đổi màu, thêm lời nhắn tối đa 50 ký tự, bật/tắt ngày chụp.
3. Bấm **Bật camera** và cấp quyền. Có lật gương, chọn webcam và chuyển camera trước/sau nếu thiết bị hỗ trợ.
4. Chọn bộ lọc và đếm ngược 0/3/5/10 giây, hoặc tùy chỉnh 1–15 giây. Chụp từng ảnh hoặc tự động các ô còn trống. Bấm **Hủy chụp** để dừng; ảnh đã chụp vẫn được giữ.
5. Chọn một ô để thay thế bằng ảnh chụp hoặc ảnh tải lên. Mỗi ô có nút tải ảnh và chụp lại. **Chụp lại tất cả** xóa bộ ảnh hiện tại.
6. Khi đủ ảnh, chọn **Xem thành phẩm**, rồi **Tải ảnh**. Ảnh PNG có cạnh dài 2400 px, tên `PhotoBeo-YYYYMMDD-HHmmss.png`. Preview thành phẩm và đường dẫn tải dùng chung một Blob PNG.

Ảnh JPEG, PNG, WebP dưới hoặc bằng 15 MB và không quá 60 megapixel được chấp nhận. Có thể tải nhiều ảnh để lấp các ô trống. Bộ lọc đang chọn được ghi vào pixel ảnh chụp/tải lên tiếp theo; ảnh đã có không bị thay đổi khi chuyển bộ lọc. Lật gương chỉ áp dụng camera, đồng nhất giữa video và ảnh chụp. Ảnh được crop cover ở tâm, không kéo méo.

Đổi bố cục giữ các ảnh hiện có theo thứ tự. Các ảnh ngoài số ô của bố cục nhỏ vẫn nằm trong phiên và xuất hiện lại khi chọn bố cục lớn. Chụp tự động chỉ lấp ô trống. Ảnh không được lưu bền vững: tải lại/đóng trang sẽ mất phiên, vì vậy hãy tải PNG trước khi rời trang.

## Camera và quyền truy cập

- Camera hoạt động trên **HTTPS** hoặc **localhost**. `http://192.168.x.x:5173` trên điện thoại thường không phải ngữ cảnh bảo mật; cần HTTPS để thử camera trên thiết bị khác. Tải ảnh lên vẫn dùng được khi không có camera.
- Nếu từ chối quyền: mở cài đặt quyền của trang trong trình duyệt rồi bật lại camera.
- Nếu camera bận: đóng ứng dụng khác đang giữ thiết bị. Nếu không có webcam: kết nối webcam hoặc tải ảnh.
- Chuyển trước/sau là yêu cầu `facingMode`; thiết bị chỉ có một camera có thể tiếp tục dùng camera đó. Danh sách camera thực tế được lấy sau khi người dùng cấp quyền.
- Tracks được dừng khi tắt/đổi camera, xem thành phẩm, rời trang hoặc component bị tháo. Yêu cầu camera trả về muộn sau khi hủy cũng được dừng.
- Không thu âm. Không tự mở camera, không gửi ảnh/video lên máy chủ.

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run test:e2e
```

Vitest kiểm tra số ô, hình học khung, crop cover, hủy countdown, dọn timer, kiểm tra tệp và tên file.

Playwright mặc định dùng Chrome được cài trên máy với camera giả, không bật webcam thật. Có thể đổi sang Edge trong PowerShell bằng `$env:PLAYWRIGHT_CHANNEL='msedge'`, hoặc Chromium của Playwright bằng `$env:PLAYWRIGHT_CHANNEL='chromium'` sau khi cài browser tương ứng. Test tự mở Vite ở cổng 5173; trên macOS/Linux lệnh cấu hình server vẫn chạy qua Node.

Các kiểm tra trình duyệt bao gồm chụp tự động/chụp lại/hủy, thay bố cục giữ ảnh, bộ lọc ghi vào pixel, tải lên, xuất cả 5 bố cục, tải PNG, từ chối quyền camera, giao diện mobile và đóng dialog bằng Escape. Ảnh chụp giao diện và PNG xuất thử nằm trong `artifacts/`. Trace lỗi được lưu ở `test-results/`.

Cần thử thêm trên webcam và điện thoại thật để xác nhận chất lượng ảnh, quyền hệ điều hành, chuyển camera trước/sau và hành vi lưu ảnh của Safari iOS. Camera giả và viewport mobile kiểm chứng luồng ứng dụng, không thay thế hoàn toàn kiểm tra phần cứng.

## Cấu trúc

```text
src/
  App.tsx                  Điều phối phiên chụp, upload và thành phẩm
  components/              Thiết lập, ảnh đã chụp, thumbnail, preview, dialog
  hooks/useCamera.ts       Stream, thiết bị, quyền, dọn tracks và chống race
  hooks/useCapture.ts      Phiên chụp, flash, hủy và khóa thao tác
  lib/layouts.ts           Nguồn hình học chung cho preview và PNG
  lib/filters.ts           Bộ lọc CSS preview và xử lý pixel tương ứng
  lib/images.ts            Decode, crop, ghép Canvas, Blob và tên file
  lib/countdown.ts         Timer có AbortSignal
  lib/core.test.ts         Kiểm tra logic
  styles.css               Giao diện và responsive
tests/photobooth.spec.ts    Kiểm tra trình duyệt
```
