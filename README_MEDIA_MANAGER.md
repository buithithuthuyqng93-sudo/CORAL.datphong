# HƯỚNG DẪN HỆ THỐNG QUẢN LÝ HÌNH ẢNH TRỰC TIẾP (MEDIA MANAGER)
**Website Homestay & CAFE CORAL Lý Sơn**

---

## 🌟 TỔNG QUAN HỆ THỐNG

Hệ thống Quản lý hình ảnh (Media Manager) cho phép **Chủ nhà / Quản trị viên (Chị Thủy & Mr Thiện)** thay đổi và cập nhật trực tiếp mọi hình ảnh trên website công khai thông qua **Dashboard Quản trị**.

### ⚡ ƯU ĐIỂM NỔI BẬT:
1. **Thay ảnh tức thì**: Website cập nhật hình ảnh ngay sau khi nhấn "Lưu thay đổi".
2. **Không cần đụng vào code**: Không cần vào Google AI Studio hay sửa tệp nguồn.
3. **Không cần Git hay Vercel**: Không phải Push GitHub hay chờ Vercel Build/Deploy lại.
4. **Hỗ trợ tải từ điện thoại & máy tính**: Tải ảnh linh hoạt mọi lúc mọi nơi.
5. **Dự phòng 100% (Fallback)**: Nếu Supabase bảo trì hoặc ngắt kết nối, website tự động chuyển sang ảnh dự phòng trong `public/images/`, đảm bảo không bao giờ trắng trang hay lỗi giao diện.
6. **Lịch sử & Khôi phục (Restore)**: Giữ lịch sử ảnh cũ, cho phép khôi phục lại bất kỳ lúc nào chỉ bằng 1 cú nhấp.

---

## 🛠️ CÁC BƯỚC THỰC HIỆN DÀNH CHO QUẢN TRỊ VIÊN

### Step 1: Đăng nhập Dashboard Quản trị
- Mở website và chuyển sang tab **"Dashboard Quản Trị"**.
- Nhập mã PIN bảo mật (Mặc định: `8888` hoặc `0868011799`).

### Step 2: Mở Menu "Quản lý hình ảnh"
Trong thanh menu chính của Dashboard, nhấp vào tab số **5. Quản lý hình ảnh**.

### Step 3: Chọn Nhóm Hình Ảnh Cần Thay Đổi
Hệ thống bao gồm 9 nhóm vị trí hình ảnh:
1. **Ảnh Hero trang chủ**: Banner chính đỉnh trang (Desktop & Mobile, căn chỉnh điểm lấy nét Focal Point, độ phủ tối overlay).
2. **Logo thương hiệu**: Logo góc Header.
3. **Ảnh giới thiệu**: Ảnh khung minh họa trong phần giới thiệu Homestay & Vách núi.
4. **Ảnh từng loại phòng**: Ảnh đại diện cho 4 hạng bungalow.
5. **Gallery chi tiết phòng**: Album ảnh chi tiết từng phòng (Kéo thả, đổi thứ tự, chọn ảnh bìa, xóa).
6. **Ảnh khu café**: Ảnh góc cà phê ngắm hoàng hôn vách núi.
7. **Ảnh tiện ích**: Bồn tắm panorama, ban công view biển, v.v.
8. **Ảnh bản đồ / địa điểm**: Vị trí vách đá địa chất Lý Sơn.
9. **Thư viện hình ảnh chung**: Danh sách tất cả ảnh dự phòng gốc.

### Step 4: Tải Ảnh Mới & Kiểm Tra Xem Trước
- Nhấp nút **"Chọn ảnh"** hoặc **kéo thả ảnh** từ máy tính / điện thoại vào khung.
- Hệ thống tự động kiểm tra định dạng (Chỉ chấp nhận JPG, PNG, WebP) và dung lượng (Tối đa 8MB).
- Xem trước ảnh sẽ hiển thị ngay lập tức để kiểm tra góc nhìn.
- Nhập **Văn bản thay thế (ALT Text)** chuẩn SEO nếu muốn.

### Step 5: Bấm "Lưu thay đổi"
- Nhấn **"Lưu thay đổi"**.
- Ảnh được tải lên kho lưu trữ đám mây **Supabase Storage** (Bucket `site-media`).
- Mọi khách truy cập website công khai sẽ thấy ngay hình ảnh mới mà không cần F5 nhiều lần nhờ cơ chế Cache Busting (`?v=timestamp`).

---

## 🗄️ CẤU TRÚC DỮ LIỆU & SUPABASE STORAGE

### 1. Bucket Storage: `site-media`
- `site-media/hero/`: Ảnh banner chính
- `site-media/logo/`: Logo thương hiệu
- `site-media/rooms/`: Ảnh hạng phòng
- `site-media/room-galleries/`: Thư viện chi tiết phòng
- `site-media/amenities/`: Ảnh tiện ích
- `site-media/cafe/`: Ảnh khu cà phê
- `site-media/locations/`: Ảnh vị trí vách núi

### 2. Các bảng Cơ Sở Dữ Liệu PostgreSQL:
- **`media_assets`**: Lưu metadata của tệp (public_url, mime_type, file_size, width, height, alt_text).
- **`site_content`**: Khóa ánh xạ vị trí ảnh hiển thị (`homepage.hero.desktop`, `homepage.hero.mobile`, `homepage.logo`, v.v.).
- **`media_history`**: Lịch sử thay đổi ảnh để phục vụ tính năng **Khôi phục ảnh trước**.

---

## 🔒 QUY TẮC BẢO MẬT & CHẾ ĐỘ DEMO

1. **Phân quyền Admin (RLS)**:
   - Khách xem website: Quyền đọc công khai (Public Read).
   - Đăng ảnh / Thay ảnh / Xóa ảnh: Chỉ dành cho Administrator đã xác thực.
2. **Chế độ Demo (Chưa kết nối Supabase)**:
   - Nếu dự án chạy ở môi trường chưa cấu hình biến môi trường Supabase, hệ thống tự động chuyển sang **Chế độ Demo Local**.
   - Admin vẫn có thể thử nghiệm chọn ảnh, xem trước và lưu vào bộ nhớ tạm thời LocalStorage mà không làm sập ứng dụng.
