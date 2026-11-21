# 🌊 HƯỚNG DẪN CẤU HÌNH PRODUCTION — SEAGULL LÝ SƠN (SEAGULL COFFEE & HOMESTAY LÝ SƠN)

Tài liệu này hướng dẫn chi tiết từng bước cách khởi tạo và cấu hình các **Biến Môi Trường (Environment Variables)** và **Cơ Sở Dữ Liệu Supabase Production** để chuyển hệ thống **SEAGULL LÝ SƠN** (27 phòng kinh doanh giai đoạn 1 / 32 phòng tổng quy hoạch) từ **Chế độ Demo** sang **Chế độ Production hoàn chỉnh**.

---

## 📌 NGUYÊN TẮC HOẠT ĐỘNG
- **Chế độ Demo (Mặc định)**: Khi chưa điền các khóa bên dưới, hệ thống tự động chạy ổn định bằng **Dữ liệu giả lập (Mock Data)** để kiểm thử giao diện và quy trình mà không ảnh hưởng dữ liệu thật.
- **Chế độ Production**: Khi điền đầy đủ biến môi trường trên Hosting (Vercel / Cloud Run / VPS), hệ thống sẽ kích hoạt:
  1. Khóa giữ phòng 15 phút xử lý đồng thời (`fn_check_and_hold_room`) và chống trùng phòng mức PostgreSQL (`EXCLUDE USING gist`) trên **Supabase Database**.
  2. Tự động **xác nhận cọc VietQR** khi **SePay** gửi Webhook (kèm chống trùng giao dịch `webhook_events`).
  3. Tự động **gửi email xác nhận** qua **Gmail API**.
  4. Tự động **đồng bộ sao lưu đơn** vào **Google Sheets**.

---

## 1️⃣ BƯỚC 1: KHỞI TẠO SUPABASE PRODUCTION DATABASE (CHỈ CHẠY DUY NHẤT 1 FILE SQL)

> **⚠️ LƯU Ý QUAN TRỌNG VỀ FILE SQL:**
> - File **`supabase_production_schema_FINAL.sql`** (nằm ngay tại thư mục gốc của dự án) là **FILE DUY NHẤT** cần chạy trong **Supabase SQL Editor** cho một project Supabase mới tinh.
> - **KHÔNG cần và KHÔNG nên chạy** 7 file migration cũ trong thư mục `supabase/migrations/` (chúng được giữ lại làm lịch sử tham khảo và có thứ tự phụ thuộc/bản nháp staging không đồng nhất).
> - File `supabase_production_schema_FINAL.sql` được thiết kế **Idempotent 100%** (có thể chạy lại nhiều lần không lỗi), đúng thứ tự phụ thuộc, đầy đủ 32 bảng, 27 phòng mở bán giai đoạn 1 + 5 phòng giai đoạn 2, ràng buộc chống trùng đặt phòng `EXCLUDE USING gist`, RPC khóa phòng 15 phút (`fn_check_and_hold_room`), Storage bucket `site-media`, và phân quyền RLS chặt chẽ theo 4 vai trò (**Owner / Reception / Accountant / Public**).

### Các bước thực hiện:
1. Đăng nhập [https://supabase.com](https://supabase.com) và tạo Project Production mới:
   - **Name**: `Seagull Ly Son PMS Production`
   - **Database Password**: Lưu mật khẩu an toàn.
   - **Region**: Chọn `Singapore (ap-southeast-1)` để có độ trễ thấp nhất về Việt Nam.
2. **Chạy file SQL khởi tạo duy nhất**:
   - Trong Supabase Dashboard, mở **SQL Editor** ở thanh bên trái ➔ nhấn **New query**.
   - Mở file **`supabase_production_schema_FINAL.sql`** ở thư mục gốc của mã nguồn, sao chép toàn bộ nội dung, dán vào SQL Editor và nhấn **Run**.
   - Xác nhận kết quả báo **Success**.
3. **Kiểm tra nhanh sau khi chạy (Tùy chọn)**:
   Chạy câu lệnh kiểm tra sau trong SQL Editor để xác nhận đủ 27 phòng mở bán GĐ1, 5 phòng GĐ2 và 3 ràng buộc chống trùng:
   ```sql
   SELECT active, COUNT(*) AS so_phong FROM public.rooms GROUP BY active ORDER BY active DESC;
   SELECT conname FROM pg_constraint WHERE conname LIKE 'exclude_overlapping_%';
   ```
   Kết quả chuẩn: `active = true: 27`, `active = false: 5`, và 3 constraint (`exclude_overlapping_room_allocations`, `exclude_overlapping_room_blocks`, `exclude_overlapping_active_bookings`).
4. **Lấy khóa kết nối API**:
   Vào **Project Settings** ➔ **API**:
   - **Project URL** ➔ gán vào `VITE_SUPABASE_URL` (và/hoặc `SUPABASE_URL` phía server).
   - **Publishable Key (`sb_publishable_...`)** hoặc **Legacy `anon` public key** ➔ gán vào `VITE_SUPABASE_PUBLISHABLE_KEY` hoặc `VITE_SUPABASE_ANON_KEY`.
   - **`service_role` secret key** ➔ gán vào `SUPABASE_SERVICE_ROLE_KEY` (**CHỈ đặt ở biến server-side**, tuyệt đối không đặt tiền tố `VITE_`).
5. **Phân quyền tài khoản nhân sự (4 vai trò RLS)**:
   Khi tạo tài khoản đăng nhập Supabase Auth cho nhân sự, gán `role` trong `app_metadata` hoặc thêm email vào bảng `public.user_roles` với 1 trong các giá trị:
   - `owner`: Toàn quyền quản trị, đổi giá, đổi tài khoản ngân hàng, hủy đơn cọc, xem sổ quỹ và lưu trú.
   - `reception`: Đọc/cập nhật check-in/check-out, khóa phòng bảo trì, quản lý hồ sơ khách lưu trú; bị chặn hủy đơn cọc và bị chặn bảng `cash_transactions`.
   - `accountant`: Đọc/ghi sổ quỹ `cash_transactions`, đọc báo cáo thanh toán & đơn hàng; bị chặn sửa trạng thái phòng và bị chặn hồ sơ giấy tờ lưu trú (`stay_guests`, `booking_stay_records`).
   - `anon` (Public): Chỉ đọc thông tin công khai (phòng đang mở bán, giá, media) và tạo đơn nháp `pending_payment`; không được đọc danh sách đơn hay PII của khách khác.

---

## 2️⃣ BƯỚC 2: CẤU HÌNH SEPAY VIETQR AUTOMATIC WEBHOOK

SePay lắng nghe biến động số dư tài khoản ngân hàng (MB Bank `0868011799`) và tự động xác nhận đơn cọc cho khách qua `/api/sepay/webhook`.

### Các bước thực hiện:
1. Đăng nhập [https://sepay.vn](https://sepay.vn) và liên kết tài khoản nhận cọc của **Seagull Lý Sơn**.
2. Vào **Cấu hình Webhook** ➔ Thêm Webhook mới:
   - **Endpoint URL**: `https://ten-mien-cua-ban.com/api/sepay/webhook`
   - **Kiểu dữ liệu**: `JSON`
   - **Mã xác thực (Secret Key)**: Tạo chuỗi bí mật ngẫu nhiên mạnh (Ví dụ: `SeagullLySon2026_SePaySecret_...`)
3. Gán mã xác thực vào biến môi trường server: `SEPAY_WEBHOOK_SECRET`.

---

## 3️⃣ BƯỚC 3: CẤU HÌNH GMAIL API GỬI EMAIL XÁC NHẬN TỰ ĐỘNG

1. Truy cập [Google Cloud Console](https://console.cloud.google.com) ➔ tạo Project `Seagull Ly Son Email Service` ➔ bật **Gmail API**.
2. Cấu hình **OAuth Consent Screen** (`External`, tên App: `SEAGULL LÝ SƠN`).
3. Tạo **OAuth Client ID** (`Web Application`) với Redirect URI `https://developers.google.com/oauthplayground` ➔ lấy `GMAIL_CLIENT_ID` và `GMAIL_CLIENT_SECRET`.
4. Lấy `GMAIL_REFRESH_TOKEN` qua OAuth2 Playground với scope `https://mail.google.com/`.
5. Điền email gửi chính thức vào `GMAIL_SENDER_EMAIL` (ví dụ: `seagull.lyson@gmail.com`).

---

## 4️⃣ BƯỚC 4: CẤU HÌNH GOOGLE SHEETS SAO LƯU ĐƠN

1. Tạo Google Sheet mới với tab tên **`BOOKINGS`** ➔ lấy **Sheet ID** từ URL gán vào `GOOGLE_SHEET_ID`.
2. Tạo **Service Account** trên Google Cloud Console ➔ tải khóa JSON ➔ gán `client_email` vào `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `private_key` vào `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
3. Nhấn **Chia sẻ (Share)** trên Google Sheet và cấp quyền **Editor** cho email Service Account.

---

## 📋 TỔNG HỢP BIẾN MÔI TRƯỜNG PRODUCTION

| Tên biến môi trường | Phạm vi | Mô tả | Bắt buộc Production |
| :--- | :---: | :--- | :---: |
| `VITE_SUPABASE_URL` | Frontend & Server | Project URL của Supabase | Có |
| `VITE_SUPABASE_PUBLISHABLE_KEY` *(hoặc `VITE_SUPABASE_ANON_KEY`)* | Frontend & Server | Khóa công khai quyền hạn tối thiểu (bảo vệ bằng RLS) | Có |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chỉ Server** | Khóa quản trị cho API `/api/*`, SePay Webhook, Cron | Có |
| `ADMIN_SESSION_SECRET` | **Chỉ Server** | Chuỗi bí mật ký token HMAC-SHA256 cho phiên Admin | Khuyến nghị |
| `ADMIN_OWNER_PASS` / `ADMIN_RECEPTION_PASS` / `ADMIN_ACCOUNTANT_PASS` | **Chỉ Server** | Mật khẩu đăng nhập từng vai trò quản trị | Khuyến nghị |
| `SEPAY_WEBHOOK_SECRET` | **Chỉ Server** | Khóa xác thực Webhook SePay | Có |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL` | **Chỉ Server** | Cấu hình gửi email xác nhận tự động | Có |
| `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | **Chỉ Server** | Cấu hình đồng bộ Google Sheets | Tùy chọn |
| `BOOKING_HOLD_MINUTES` | Server | Thời gian giữ phòng mặc định (`15`) | Tùy chọn |
| `CRON_SECRET` | **Chỉ Server** | Khóa bảo vệ endpoint `/api/cron/expire-holds` | Khuyến nghị |
| `TIMEZONE` | Server | Múi giờ hệ thống (`Asia/Ho_Chi_Minh`) | Tùy chọn |
