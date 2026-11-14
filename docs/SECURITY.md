# Mô hình dữ liệu và xác thực ảnh

## Luồng được chấp nhận

Photobooth hoạt động local trước. Người dùng chọn “Thêm vào Creative Wall”, đọc thông báo và tích đồng ý. Trình duyệt mới gửi các ảnh gốc đã chuẩn hóa 1600×1200 cùng layout, frame và công thức màu tới `/api/booth/camera/complete` hoặc `/api/booth/upload/complete`.

Server không nhận một PNG thành phẩm tùy ý để đóng dấu. Server kiểm tra schema, số ảnh của bố cục, công thức, MIME **và byte ảnh thực**, độ phân giải, dung lượng; decode bằng Sharp, bỏ EXIF và render thành phẩm bằng pipeline pixel/hình học dùng chung. Chỉ sau render thành công, server ghi giao dịch nguyên tử:

- `photoId`, `assetId`: UUID do server sinh.
- `createdAt`: thời gian server.
- `ownerSessionId`: lấy từ cookie phiên đã xác thực, không từ body.
- `origin`: loại endpoint của quy trình đăng ký camera/upload.
- `verificationStatus`: server gán `verified` sau kiểm tra và render.
- `photoBeoVersion`: `2.0.0`.
- Kích thước, dung lượng và PNG BLOB riêng tư.

Schema strict từ chối trường `photoId`, `ownerSessionId`, `origin` hoặc `verificationStatus` tự gửi thêm. `requestId` chỉ là khóa chống tạo bản sao khi retry, không phải bằng chứng xác thực; khóa được ghép với owner trên server.

Ảnh nguồn chỉ xử lý trong bộ nhớ của request, không lưu database hoặc ghi log. Thư viện lưu PNG đã ghép; muốn sửa lại ảnh nguồn cần quay về phiên photobooth chưa đóng. Preset màu được lưu localStorage vì chỉ là tham số người dùng, không dùng để xác thực ảnh.

## Ý nghĩa chính xác của “đã xác thực”

Xác thực nghĩa là **thành phẩm đã được server PhotoBeo kiểm tra/render/đăng ký và thuộc phiên đang truy cập**. Nó không chứng minh tác giả, quyền tác giả, danh tính người chụp hoặc ảnh thực sự đến từ webcam vật lý. Trong web thông thường, client có thể tạo một bitmap và gọi endpoint camera; không có chứng thực phần cứng cho pixel webcam. `origin` chỉ mô tả luồng đăng ký, không được dùng để nâng quyền hay bỏ qua kiểm tra.

Ảnh bất kỳ muốn dùng trên bảng phải đi qua quy trình photobooth được phép (nguồn upload cũng được chấp nhận), được ghép và đăng ký. Không có endpoint upload ảnh trực tiếp vào Creative Wall. Watermark là nhận diện thương hiệu, không phải cơ chế bảo mật.

## Quyền riêng tư và API

- Token phiên ngẫu nhiên 256 bit; database chỉ lưu SHA-256 của token. Cookie HttpOnly/SameSite=Strict, Secure và prefix `__Host-` trong production.
- GET ảnh và thư viện luôn tra cứu `ownerSessionId` từ phiên. Không có URL asset công khai hoặc thư mục ảnh static.
- PUT wall kiểm tra mọi photoId là record verified của owner; từ chối ID giả, ID phiên khác, URL tùy ý, sai tỷ lệ ảnh, tọa độ/giá trị sai, trùng item ID hoặc quá 60 item.
- Thứ tự item là thứ tự layer. Lưu revision để ngăn tab cũ ghi đè tab mới; lỗi 409 yêu cầu tải lại bản đã lưu.
- Mọi thao tác ghi yêu cầu Origin nằm trong allowlist **và** CSRF token phiên. Không cấu hình CORS wildcard.
- Responses `/api` dùng `Cache-Control: no-store, private`, `nosniff`, CORP same-origin. Không cache dữ liệu riêng tư ở CDN.
- Giới hạn body 24 MB cho đăng ký ảnh, 64 KB cho bố cục; mỗi ảnh nguồn tối đa 4 MB/12 MP tại API. Client chuẩn hóa từ file JPEG/PNG/WebP ≤15 MB/60 MP. Không nhận ảnh động hoặc SVG.
- Hạn chế render đồng thời, quota theo phiên và rate limit IP. Quota ảnh theo giờ còn được truy vấn từ database.
- Ghi chú là text vẽ lên Canvas, không đưa vào innerHTML. File remote URL không được server tải về, tránh SSRF qua nguồn ảnh.

## Phạm vi kiểm tra

Test server dùng hai phiên độc lập: đăng ký và lấy PNG, thử lấy ảnh phiên khác, fake ID, forged metadata, CSRF, Origin sai, file giả, revision conflict, khởi động lại database, retry idempotent và xóa record/asset/phiên. E2E kiểm tra không có request đăng ký trước khi đồng ý và luồng lưu/đọc/xuất bảng qua API thật.

Giới hạn còn lại: chưa có tài khoản/recovery, chưa có moderation/public sharing, rate limit trong bộ nhớ không phân tán, cần hạ tầng production/HTTPS/volume và chính sách backup của đơn vị vận hành. Không coi kiểm thử ứng dụng là một cuộc pentest toàn bộ hạ tầng.
