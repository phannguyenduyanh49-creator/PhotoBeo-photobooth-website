# Chạy và triển khai PhotoBeo 2.0

## Local — frontend + backend

Yêu cầu Node.js 24+, npm, Chrome hoặc Edge. Mở PowerShell:

```powershell
cd D:\Prj\photobeo
npm.cmd ci
npm.cmd run dev
```

Lệnh dev mở Vite ở `http://localhost:5173` và API ở `http://127.0.0.1:3001`. Vite proxy `/api` về backend, nên cookie và ảnh riêng tư luôn cùng origin với frontend. `/memory-wall` là trang Góc kỷ niệm.

Không cần secret để thử local. Nếu muốn cấu hình, sao chép `.env.example` thành `.env`. Không đưa `.env`, `.data`, `.test-data` vào Git.

- `npm run dev:client`: chỉ frontend; chụp, chỉnh màu và tải PNG vẫn hoạt động, nhưng Creative Wall sẽ báo chưa kết nối server.
- `npm run build`: kiểm tra TypeScript và build Vite vào `dist/`.
- `npm start`: chạy API và phục vụ bản `dist/` đã build. Với mặc định local, mở `http://localhost:3001`.
- `npm run preview`: chỉ xem build frontend; không thay thế backend. Để thử toàn bộ build hãy dùng `npm start`.
- Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd`. Trên macOS/Linux dùng `npm`.

Camera cần HTTPS hoặc localhost. IP LAN qua HTTP không đủ điều kiện mở camera trên phần lớn trình duyệt; tải ảnh vẫn dùng được.

## Production đơn giản nhất: một Node service

Build và chạy repository trên một Node 24 service có ổ đĩa bền vững. Backend có thể đồng thời phục vụ frontend nên không cần CORS.

```sh
npm ci
npm run build
npm start
```

Cấu hình môi trường:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
FRONTEND_ORIGIN=https://photobeo.your-domain.example
PHOTO_BEO_DATA_DIR=/persistent/photobeo
TRUST_PROXY=0
```

`FRONTEND_ORIGIN` phải chính xác, không có dấu `/` cuối. Có thể khai báo nhiều origin bằng dấu phẩy. Production từ chối khởi động nếu thiếu origin HTTPS. Cookie production dùng prefix `__Host-`, Secure, HttpOnly, SameSite=Strict và Path=/.

Reverse proxy cần chuyển nguyên Cookie, Set-Cookie, Origin, X-CSRF-Token; không cache `/api`, cho phép JSON tối đa 24 MB và timeout tối thiểu 60 giây. Chỉ đặt `TRUST_PROXY=1` khi backend thật sự nằm sau một proxy tin cậy và không thể bị truy cập vòng qua proxy đó. Không nhận tùy ý X-Forwarded-For từ Internet.

Chạy **một instance** với ổ đĩa riêng. SQLite và rate limit trong tiến trình phù hợp bản đầu quy mô nhỏ. Nếu cần nhiều instance, chuyển database/blob storage và rate limit sang dịch vụ dùng chung; không nhân bản các instance cùng dùng file SQLite trên network filesystem.

## Frontend Vercel + backend riêng

Frontend vẫn là Vite static. Vercel không phải nơi lưu SQLite lâu dài; backend Node và volume phải ở một dịch vụ có persistent disk.

1. Triển khai backend Node như trên, nhận URL HTTPS thật của backend.
2. Sinh cấu hình proxy với URL backend thật:

```sh
node scripts/configure-vercel.mjs https://your-node-backend.example
```

Script cập nhật `vercel.json`: `/api/:path*` được reverse proxy tới backend; `/memory-wall` được rewrite về `index.html`. URL backend là cấu hình công khai, không phải secret. Không nhét token hoặc mật khẩu vào URL.

3. Trên Vercel dùng framework Vite, build `npm run build`, output `dist`, Node 24.
4. Đặt `FRONTEND_ORIGIN` trên backend bằng domain HTTPS **frontend Vercel**. Thêm các preview origin cụ thể nếu cần; không dùng wildcard. Dùng cùng một domain ổn định để giữ cookie phiên.
5. Kiểm tra `/api/health`, lưu một ảnh sau bước đồng ý, reload `/memory-wall`, rồi thử một trình duyệt khác để xác nhận ảnh không xuất hiện ở phiên khác.

`vercel.json` được bàn giao chỉ cấu hình SPA vì chưa có URL backend production. Nếu chỉ deploy frontend mà chưa cấu hình proxy, chức năng local vẫn dùng được và Creative Wall báo lỗi kết nối rõ ràng.

Tham khảo chính thức: [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Node SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

## Docker (tùy chọn)

Có Dockerfile dùng Node 24, chạy bằng user không đặc quyền. Mount volume bền vững tại `/data` và đặt các biến môi trường production ở trên. Nếu mount thư mục host, đảm bảo user `node` có quyền ghi. Terminate HTTPS ở reverse proxy.

```sh
docker build -t photobeo .
docker run --rm -p 3001:3001 -v photobeo-data:/data \
  -e FRONTEND_ORIGIN=https://photobeo.your-domain.example photobeo
```

Dockerfile chưa được chạy trong phiên phát triển này; quy trình Node local được kiểm tra trực tiếp.

## Dữ liệu và vận hành

- Database: `PHOTO_BEO_DATA_DIR/photobeo.sqlite`, cùng các file SQLite WAL/SHM khi đang chạy. Bảng sessions, photos, assets (PNG BLOB), walls.
- Sao lưu nhất quán bằng SQLite backup API hoặc dừng service trước khi copy toàn bộ data directory. Mã nguồn không chứa ảnh người dùng.
- Phiên ẩn danh tồn tại 30 ngày. Quá hạn sẽ bị từ chối truy cập ngay; dữ liệu hết hạn được dọn khi khởi động và mỗi giờ. Mất cookie không có cơ chế khôi phục ở bản này.
- Xóa ảnh ở thư viện sẽ xóa record và BLOB. Phải gỡ ảnh khỏi bảng đã lưu trước khi xóa. “Xóa dữ liệu riêng tư của tôi” xóa cả phiên, thư viện và bố cục.
- Bản sao lưu do bên vận hành quản lý cần có thời hạn lưu/xóa riêng; xóa trong ứng dụng không tự xóa các backup bên ngoài.
- Giới hạn: 100 ảnh/phiên, khoảng 250 MB/phiên, khoảng 2 GB dữ liệu toàn service; tối đa 60 đối tượng/bảng, hai lượt render đồng thời. Đăng ký ảnh 20 lần/giờ; có giới hạn request và tạo phiên theo IP. Quota được kiểm tra trước render nên có thể vượt nhẹ bằng kích thước PNG cuối.
- Đây không phải hệ thống tài khoản đa thiết bị, chia sẻ công khai hay hệ thống chống bot phân tán. Cần lớp rate limit/WAF của hạ tầng nếu đưa ra Internet với lưu lượng lớn.
