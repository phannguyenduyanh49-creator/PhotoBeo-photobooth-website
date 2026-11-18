# Bảo mật và vòng đời dữ liệu 3.0

## Quyền sở hữu

Tài khoản khách users bền vững; phiên sessions có cookie token random 256-bit, chỉ hash token lưu DB. Cookie HttpOnly, SameSite=Strict, Secure + __Host- trên HTTPS. Session 30 ngày không kéo theo xóa tài khoản/Wall.

Tạo mã khôi phục do người dùng chủ động thực hiện trong Lịch sử. Mã 256-bit là quyền truy cập tài khoản, chỉ hash lưu DB, không lưu browser localStorage. Tạo mã mới vô hiệu mã cũ; phiên đăng nhập đã cấp vẫn tồn tại tới hết hạn hoặc xóa tài khoản. Người có mã có thể đọc và xóa thư viện. Không phải tài khoản email/password hoặc OAuth, không có trung tâm hỗ trợ khôi phục khi mất cả cookie lẫn mã.

Mỗi mutation cần Origin allowlist và CSRF token timing-safe. Restore yêu cầu một phiên trình duyệt mới có CSRF hợp lệ và mã bí mật của tài khoản đích; không nhận userId để đổi chủ sở hữu.

## Ảnh và Wall

Không tự upload khi chụp/chỉnh/download. POST booth chỉ nhận consent=true, requestId, layout/options, ảnh gốc và công thức màu. Strict schema từ chối owner/verified/photoId/origin tự gán. Server đọc nội dung thực, kiểm MIME/dimensions/kích thước, decode/reencode bỏ EXIF, render PNG; ảnh gốc chỉ xử lý trong RAM.

Verified xác nhận record đã qua server PhotoBeo, không chứng minh webcam vật lý hay quyền tác giả. Endpoint camera/upload mô tả luồng đăng ký.

Mọi read/write/delete ảnh/Wall lọc userId từ session server. Wall chỉ nhận photoId của history chưa hết hạn hoặc permanent asset đã thuộc chủ sở hữu. URL tùy ý, photoId giả/ngoại tài khoản và tỷ lệ ảnh sai bị chặn. Bản sao permanent có assetId/storageKey riêng, metadata expiresAt=null. Không có FK từ permanent về history nên xóa history không thể xóa bản sao.

Vị trí, kích thước, rotation, thứ tự lớp, ghi chú và sticker được lưu trong memory_walls + wall_items trong một transaction. Revision phát hiện sửa đồng thời từ tab khác. Gỡ ảnh khỏi canvas không tự xóa bản sao khỏi thư viện Wall; xóa bản sao cần gỡ và Save trước. Xóa cả bảng có thao tác riêng.

## Truy cập tệp

Objects private ngoài public/dist hoặc trong private S3 bucket. Client dùng URL ứng dụng có chữ ký HMAC, hết hạn 5 phút; endpoint kiểm chữ ký, owner cookie, trạng thái ready và expiry lịch sử. Không có URL tệp công khai. Cache-Control no-store/private, nosniff và CORP same-origin. Lịch sử/Wall làm mới link định kỳ; tải lại trang khi link cũ hết hạn.

Các biến AWS/S3 chỉ ở server. Bucket không cấp public ACL. Không ghi token, recovery key, signed URL hoặc raw image vào application logs.

## Cleanup an toàn

History createdAt/expiresAt do server tạo: đúng 30×24 giờ. Lookup chặn hết hạn tại timestamp, không phụ thuộc job. Xóa metadata và ghi outbox atomic, storage delete retry/idempotent; lỗi storage không làm ảnh hết hạn hiện trở lại. Photo session metadata không còn history được xóa. Phiên hết hạn bị xóa riêng, không cascade users/Wall.

Pending object upload được journal trước I/O để có thể thu gom sau crash. Migration giữ BLOB staging đến khi objects đã ghi thành công. Metadata và storage không có transaction phân tán; outbox/staging xử lý các cửa sổ lỗi này. Backup/noncurrent S3 versions theo chính sách vận hành riêng, không thể hứa xóa mọi bản backup ngay.

## Giới hạn

180 request/phút/IP, 30 phiên mới/giờ/IP, 20 registration/giờ/IP và tài khoản; restore 10/giờ/IP. Mỗi nguồn backend tối đa 4 MiB, 12 MP, không ảnh động; payload 24 MiB. Client nhận file 15 MiB/60 MP rồi chuẩn hóa 1600×1200 trước khi đăng ký. Hai render đồng thời, 60 wall items, 200 assets/500 MiB mỗi tài khoản, 2 GiB toàn instance.

Một instance Express/SQLite; chưa có OAuth, PostgreSQL, queue phân tán hoặc kiểm chứng S3/cloud production. Không dùng mã khôi phục như cơ chế phân quyền chia sẻ công khai.
