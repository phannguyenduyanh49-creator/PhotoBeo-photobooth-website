# Triển khai PhotoBeo 3.0

## 1. Local và build

Node 24+, npm. npm ci rồi npm run dev chạy frontend 5173 + API 3001. Routes /, /history, /memory-wall. npm run build chạy TypeScript + Vite. npm start phục vụ dist và API cùng origin, mặc định http://localhost:3001.

Chưa cần cloud: SQLite ở PHOTO_BEO_DATA_DIR/photobeo.sqlite, objects ở PHOTO_BEO_DATA_DIR/objects. Thư mục objects nằm ngoài public/dist; không được mount như static/public URL.

## 2. Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| NODE_ENV | production bật cookie Secure |
| HOST / PORT | mặc định 127.0.0.1 / 3001; container dùng 0.0.0.0 |
| FRONTEND_ORIGIN | origin được phép mutation; production phải HTTPS, phân cách bằng dấu phẩy |
| PHOTO_BEO_DATA_DIR | persistent directory SQLite, mặc định .data |
| STORAGE_DRIVER | local (mặc định) hoặc s3 |
| PHOTO_BEO_OBJECT_DIR | private local object root, mặc định data/objects |
| S3_BUCKET | private bucket, bắt buộc khi driver s3 |
| AWS_REGION | mặc định us-east-1 |
| S3_ENDPOINT | endpoint HTTPS của nhà cung cấp S3-compatible; bỏ trống dùng AWS |
| AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN | server-only hoặc IAM role qua SDK credential chain |
| TRUST_PROXY | chỉ đặt 1 sau đúng một reverse proxy tin cậy, chặn truy cập trực tiếp |

Không đặt secrets trong VITE_*, frontend, Git hoặc URL. Giữ .env ngoài Git. Key/role chỉ cần PutObject/GetObject/DeleteObject cho temporary/* và permanent/*. Bật Block Public Access, TLS và encryption của nhà cung cấp. Không đặt lifecycle 30 ngày cho toàn bucket vì permanent/* phải giữ lâu dài; app quản lý cleanup temporary.

SQLite không đặt trên ephemeral filesystem hoặc network filesystem chia sẻ. Chỉ một API instance; khóa render/mutation trong tiến trình. Muốn scale nhiều instance phải chuyển metadata sang PostgreSQL và khóa/queue phân tán. Không triển khai SQLite vào Vercel Functions.

## 3. Migration v2 → v3

1. Dừng ứng dụng 2.0; sao lưu toàn bộ data directory trước nâng cấp.
2. Cài dependencies, build bản 3.0; giữ nguyên PHOTO_BEO_DATA_DIR.
3. Chạy npm run migrate. Lệnh này cũng hoàn tất import object và cleanup ảnh đã hết hạn. Kiểm tra exit code trước khi mở traffic.
4. Chạy npm start và kiểm tra history, Wall cùng cookie cũ.

server/database.ts dùng PRAGMA user_version=3 và transaction:
- Tạo users, sessions, photo_sessions, photos, photo_assets, memory_walls, wall_items, deletion_outbox, migration_blobs.
- Giữ photoId và userId cũ, chuyển cookie cũ sang session thuộc tài khoản.
- Ảnh cũ: expiresAt = createdAt + 30 ngày. Ảnh đã có trên Wall được tạo thêm permanent object, kể cả lịch sử cũ đã hết hạn.
- Blob cũ được giữ trong migration_blobs cho tới khi put object thành công. Upload có cùng storageKey khi retry. Chỉ sau đó xóa staging BLOB và đánh dấu ready.
- Nếu storage lỗi, API trả 503 trong lúc startup lỗi; sửa cấu hình/dịch vụ và khởi động lại để tiếp tục. Không cần sửa thủ công record verified.
- Các index cho expiration, owner/createdAt, asset kind/state và session expiry đã có.

Schema migration chạy lại an toàn. Không hạ phiên bản executable trên database v3. Rollback bằng bản backup trước nâng cấp **kèm kho objects tương ứng**; những ảnh lưu sau thời điểm backup sẽ không tự xuất hiện trong bản rollback.

Không chỉ đổi STORAGE_DRIVER trên kho đang có dữ liệu. Khi đổi local → S3, dừng writes, sao chép mọi object với đúng key, xác minh checksum và số lượng, sao lưu database rồi đổi driver. Adapter không tự di chuyển bucket hiện hữu.

## 4. Cleanup và scheduler

API chạy cleanup lúc khởi động và mỗi 60 giây. npm run cleanup dùng cùng cấu hình để scheduler gọi; mã thoát 1 nếu còn object delete lỗi hoặc migration thất bại. Có thể dùng Task Scheduler Windows / cron Linux mỗi phút (working directory là repository, cùng user dịch vụ và env). Không expose cleanup thành API công khai.

Cleanup:
- Điều kiện expiresAt <= thời gian máy chủ UTC; mỗi ảnh hết hạn bị chặn đọc/list ngay cả khi job chưa chạy.
- Transaction xóa history record và temporary asset metadata, ghi storageKey vào deletion_outbox.
- Xóa Storage ngoài transaction. Xóa thành công thì bỏ job; thất bại giữ attempts/lastError để chạy lại.
- Delete object idempotent (key duy nhất, không tái sử dụng). Jobs được lưu bền qua restart; một lần chạy xử lý tối đa 500 jobs.
- Pending upload bị ngắt được thu gom sau một giờ; staging migration không bị thu gom nhầm.
- Không thu gom permanent assets do history/session hết hạn. Xóa Wall, xóa asset hoặc xóa tài khoản là thao tác riêng có xác nhận.

Monitor exit code, deletion_outbox count/attempts, disk/bucket size và startup logs. Đồng bộ đồng hồ máy chủ bằng NTP. Thời hạn truy cập chính xác 30 ngày; xóa vật lý có thể chậm khi scheduler/storage ngừng hoạt động. Temp files .tmp từ tiến trình bị kill trong lúc local atomic write có thể cần dọn trong bảo trì offline.

## 5. Hosting

Phương án đơn giản: một Node service với persistent disk, HTTPS reverse proxy, same-origin frontend + API. Cấu hình FRONTEND_ORIGIN bằng origin thật; TRUST_PROXY=1 chỉ khi đúng topology. Health endpoint /api/health chỉ ready sau migration/import/cleanup startup.

Dockerfile có sẵn nhưng Docker/cloud chưa được chạy kiểm chứng trong lần nâng cấp này. Mount volume có quyền ghi cho user node ở /data. Không bake .env hoặc dữ liệu thật vào image.

Nếu frontend trên Vercel: Node backend riêng vẫn bắt buộc.
- node scripts/configure-vercel.mjs https://your-node-backend.example tạo proxy /api và SPA rewrites.
- Cấu hình FRONTEND_ORIGIN trên backend bằng domain frontend.
- Kiểm chứng reverse proxy giữ Cookie/Set-Cookie/Origin, HTTPS Secure cookie, body limit đủ 24 MiB, timeout đủ render.
- Chưa có backend URL/credentials thực tế: vercel.json hiện chỉ có routes frontend; chưa xác minh tính năng lưu ảnh trên production.

## 6. Backup và recovery Memory Wall

Local:
1. Dừng service và scheduler, đợi các request hoàn tất (SIGTERM đóng DB).
2. Sao lưu toàn bộ PHOTO_BEO_DATA_DIR, cả photobeo.sqlite và WAL/SHM nếu còn; kèm PHOTO_BEO_OBJECT_DIR nếu tách riêng. Giữ metadata và objects trong cùng snapshot.
3. Mã hóa backup, hạn chế quyền, đặt retention và thử restore định kỳ trên directory mới.
4. Restore toàn bộ snapshot vào instance cô lập, cùng driver; npm run migrate rồi npm start. Dùng một mã khôi phục test để kiểm tra Wall, ảnh, geometry và export. Không dùng mã người thật trong logs/test artifacts.

S3:
- Backup SQLite nhất quán và bật versioning/backup policy bucket. Lưu manifest keys/version IDs theo thời điểm snapshot; database chứa các storageKey cần khôi phục.
- Khi restore snapshot cũ, phải restore object versions tương ứng; không chỉ restore DB nếu user đã xóa object sau snapshot.
- Metadata users (hash recovery key) cũng cần backup để giữ quyền truy cập.
- Chính sách xóa người dùng cần bao gồm retention backup theo thời gian đã công bố. Xóa active object không đồng nghĩa xóa ngay mọi backup hoặc noncurrent version.

Quy trình backup là hướng dẫn vận hành; chưa xác minh restore trên cloud thật. Bộ test đã kiểm tra migration legacy, restart persistence, outbox retry, cookie/recovery và vòng đời hai kho với dữ liệu giả.
