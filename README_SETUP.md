# 🌺 HƯỚNG DẪN CẤU HÌNH PRODUCTION - HOMESTAY & CAFE CORAL LÝ SƠN

Tài liệu này hướng dẫn chi tiết từng bước cho **Chị Thủy** cách khởi tạo tài khoản và lấy các **Khóa Môi Trường (Environment Variables)** để chuyển hệ thống Đặt phòng Homestay & CAFE CORAL Lý Sơn từ **Chế độ Demo** sang **Chế độ Production hoàn chỉnh**.

---

## 📌 NGUYÊN TẮC HOẠT ĐỘNG
- **Chế độ Demo (Mặc định)**: Khi chưa điền các khóa bên dưới, hệ thống tự động chạy ổn định bằng **Dữ liệu giả lập (Mock Data)**. Khách hàng vẫn có thể trải nghiệm chọn phòng, tạo đơn và xem QR VietQR mà **không bao giờ bị lỗi hay trắng trang**.
- **Chế độ Production**: Khi điền đầy đủ các khóa môi trường bên dưới vào bảng **Environment Variables** (trên Vercel/Cloud Run/Hosting), hệ thống sẽ kích hoạt tự động:
  1. Khóa giữ phòng **xử lý giao dịch đồng thời** trên **Supabase Database**.
  2. Tự động **xác nhận cọc VietQR** khi SePay gửi Webhook.
  3. Tự động **gửi email xác nhận** bằng **Gmail API** chính thức.
  4. Tự động **đồng bộ lưu trữ đơn** vào **Google Sheets**.

---

## 1️⃣ BƯỚC 1: CẤU HÌNH SUPABASE DATABASE (PostgreSQL & Lock Room RPC)

Supabase quản lý danh sách phòng, trạng thái khóa giữ phòng 15 phút, và chống trùng đơn khi có nhiều khách đặt cùng lúc.

### Các bước thực hiện:
1. Đăng ký/Đăng nhập tài khoản miễn phí tại [https://supabase.com](https://supabase.com).
2. Tạo Project mới:
   - **Name**: `Coral Homestay Ly Son PMS`
   - **Database Password**: Lưu lại mật khẩu của bạn.
   - **Region**: Chọn `Singapore (ap-southeast-1)` để có tốc độ nhanh nhất về Việt Nam.
3. Sau khi tạo xong, vào **Project Settings** (biểu tượng Bánh răng ở góc dưới bên trái) ➔ chọn **API**:
   - Sao chép **Project URL** ➔ Gán vào: `VITE_SUPABASE_URL`
   - Sao chép **`anon` `public` key** ➔ Gán vào: `VITE_SUPABASE_ANON_KEY`
   - Sao chép **`service_role` `secret` key** (Nhấp Reveal) ➔ Gán vào: `SUPABASE_SERVICE_ROLE_KEY`
4. Chạy File SQL khởi tạo:
   - Trong giao diện Supabase, chọn mục **SQL Editor** ở thanh menu bên trái.
   - Dán toàn bộ nội dung trong file `supabase_schema.sql` (ở thư mục gốc của mã nguồn này) và chọn **Run**.

---

## 2️⃣ BƯỚC 2: CẤU HÌNH SEPAY VIETQR AUTOMATIC WEBHOOK

SePay lắng nghe biến động số dư ngân hàng/VietQR và tự động xác nhận đơn cọc cho khách trong vòng 3 giây mà không cần kiểm tra thủ công.

### Các bước thực hiện:
1. Đăng ký tài khoản tại [https://sepay.vn](https://sepay.vn).
2. Kết nối Ngân hàng / Tài khoản MBBank/VietinBank/TPBank/... nhận tiền cọc của Homestay CORAL.
3. Tạo Webhook trên SePay:
   - Vào menu **Cấu hình Webhook** ➔ Thêm Webhook mới.
   - **Gọi đến URL (Endpoint)**: `https://ten-miendain-cua-ban.com/api/sepay/webhook`
   - **Kiểu dữ liệu**: `JSON`
   - **Mã xác thực (Secret Key)**: Tự nghĩ ra một chuỗi bí mật ngẫu nhiên (Ví dụ: `CoralLySon2026_SePaySecretKey_8921`)
4. Sao chép Mã xác thực này ➔ Gán vào: `SEPAY_WEBHOOK_SECRET`

---

## 3️⃣ BƯỚC 3: CẤU HÌNH GMAIL API GỬI EMAIL XÁC NHẬN TỰ ĐỘNG

Dùng tài khoản Gmail của Homestay (`coral.homestay.lyson@gmail.com`) để tự động gửi email xác nhận cọc chuyên nghiệp cho khách hàng.

### Các bước thực hiện:
1. Truy cập [Google Cloud Console](https://console.cloud.google.com).
2. Tạo Project mới tên `Coral Homestay Email Service`.
3. Trong ô tìm kiếm, gõ **Gmail API** ➔ Nhấn **Enable (Bật)**.
4. Mục **OAuth Consent Screen**:
   - Chọn `External` ➔ Đặt tên App: `Homestay CORAL Lý Sơn`.
   - Điền Email hỗ trợ: `coral.homestay.lyson@gmail.com`.
5. Mục **Credentials** ➔ **Create Credentials** ➔ Chọn **OAuth Client ID**:
   - **Application Type**: `Web Application`.
   - **Authorized redirect URIs**: Thêm `https://developers.google.com/oauthplayground`
   - Nhấn Create và lưu lại **Client ID** và **Client Secret**:
     - Gán Client ID vào: `GMAIL_CLIENT_ID`
     - Gán Client Secret vào: `GMAIL_CLIENT_SECRET`
6. Lấy Refresh Token:
   - Truy cập [Google OAuth2 Playground](https://developers.google.com/oauthplayground).
   - Bấm biểu tượng bánh răng ⚙️ góc trên bên phải ➔ Tích chọn `Use your own OAuth credentials` ➔ Dán Client ID & Client Secret vừa lấy.
   - Ở cột bên trái, tìm mục **Gmail API v1** ➔ Tích chọn `https://mail.google.com/` ➔ Nhấn **Authorize APIs**.
   - Đăng nhập bằng Gmail Homestay và chấp nhận quyền.
   - Nhấn **Exchange authorization code for tokens** ➔ Sao chép giá trị **Refresh Token**:
     - Gán Refresh Token vào: `GMAIL_REFRESH_TOKEN`
7. Điền email gửi:
   - `GMAIL_SENDER_EMAIL=coral.homestay.lyson@gmail.com`

---

## 4️⃣ BƯỚC 4: CẤU HÌNH GOOGLE SHEETS LƯU TRỮ VÀ SAO LƯU ĐƠN

Tự động lưu dòng dữ liệu đơn đặt phòng mới và trạng thái cọc vào file Google Sheets quản lý của Homestay.

### Các bước thực hiện:
1. Tạo một File Google Sheets mới trong Google Drive của Homestay:
   - Đổi tên trang tính (Tab name) thành: **`BOOKINGS`**
   - Mở File, nhìn lên đường dẫn URL trình duyệt để lấy **Sheet ID**:
     - Ví dụ URL: `https://docs.google.com/spreadsheets/d/1A2b3C4d5E6f7G8h9I0j/edit`
     - Mã Sheet ID là: `1A2b3C4d5E6f7G8h9I0j`
     - Gán vào: `GOOGLE_SHEET_ID`
2. Tạo Service Account trong Google Cloud Console:
   - Vào **IAM & Admin** ➔ **Service Accounts** ➔ **Create Service Account**.
   - Đặt tên: `coral-sheets-sync`.
   - Tạo khóa (Keys) ➔ Chọn dạng **JSON** ➔ Tải file về máy.
3. Mở file JSON vừa tải bằng Notepad:
   - Sao chép `client_email` ➔ Gán vào: `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Sao chép `private_key` ➔ Gán vào: `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
4. **CẤP QUYỀN TRUY CẬP SHEETS**:
   - Mở File Google Sheets ở Bước 1 ➔ Nhấn nút **Chia sẻ (Share)**.
   - Dán địa chỉ email Service Account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) vào và cấp quyền **Người chỉnh sửa (Editor)**.

---

## 📋 TỔNG HỢP DANH SÁCH BIẾN MÔI TRƯỜNG TRÊN DEPLOYMENT (VERCEL / CLOUD RUN)

Sao chép toàn bộ danh sách tên biến này vào mục **Environment Variables** trên trang quản trị Hosting của bạn:

| Tên biến môi trường | Giá trị ví dụ | Bắt buộc cho Production |
| :--- | :--- | :---: |
| `VITE_SUPABASE_URL` | `https://xyz.supabase.co` |  Có |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |  Có |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` |  Có |
| `SEPAY_WEBHOOK_SECRET` | `CoralLySon2026_SePaySecretKey_8921` |  Có |
| `GMAIL_CLIENT_ID` | `123456...apps.googleusercontent.com` |  Có |
| `GMAIL_CLIENT_SECRET` | `GOCSPX-...` |  Có |
| `GMAIL_REFRESH_TOKEN` | `1//04...` |  Có |
| `GMAIL_SENDER_EMAIL` | `coral.homestay.lyson@gmail.com` |  Có |
| `GOOGLE_SHEET_ID` | `1A2b3C4d5E6f7G8h9I0j` |  Có |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `coral-sheets-sync@...gserviceaccount.com` |  Có |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n..."` |  Có |
| `BOOKING_HOLD_MINUTES` | `15` | Tùy chọn |
| `CRON_SECRET` | `MySecretCronKey123` | Tùy chọn |
| `TIMEZONE` | `Asia/Ho_Chi_Minh` | Tùy chọn |

---

Nếu cần hỗ trợ kỹ thuật thêm trong quá trình triển khai, Chị Thủy có thể xem lại file `README_SETUP.md` này hoặc cập nhật trực tiếp trên bảng điều khiển quản trị Admin của hệ thống.
