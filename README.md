# Hoang's Memories

**Hoang's Memories** — Bản đồ Hành trình & Kho lưu trữ kỷ niệm du lịch qua ảnh của **Phạm Quốc Hoàng**. Tự động ghim toạ độ GPS, phân loại theo điểm đến và mốc thời gian, đồng bộ Google Drive.

**Dùng thử:** https://hoangpham.is-a.dev/memories/

## Tính năng nổi bật

- 🗺️ **Bản đồ Hành trình tương tác (Travel Map):** Bản đồ nền tối sắc nét (ESRI World Dark Gray) với các điểm ghim tròn đồng tâm phát sáng tại các thành phố/điểm đến đã ghé thăm.
- 🗂️ **Khay Điểm đến (Destinations Drawer):** Đếm số điểm đến đã ghé thăm (VD: *89 cities visited*), tự động nhóm ảnh theo địa danh, bấm vào thẻ điểm đến để lướt bản đồ tới vị trí đó.
- 📅 **Dòng thời gian (Timeline View):** Sắp xếp album ảnh theo từng mốc thời gian (Tháng/Năm) như một cuốn nhật ký hành trình.
- 📍 **Ghim vị trí 1-Chạm:** Đối với ảnh tải từ Facebook/Zalo bị xoá GPS, người dùng có thể bấm chọn nhanh địa danh (Hà Nội, Đà Nẵng, TP.HCM, Phú Quốc...) để ghim ảnh lên bản đồ.
- ☁️ **Lưu trữ Google Drive an toàn:** Kết nối trực tiếp tài khoản Google qua OAuth 2.0 (`drive.file`). Dữ liệu lưu trong thư mục riêng của bạn, không qua server trung gian.
- 📷 **Đọc thông số kỹ thuật (EXIF):** Nhận diện thiết bị chụp (iPhone, Sony, Canon...), khẩu độ, tiêu cự, ISO, tốc độ chụp.
- 🔗 **Tạo link nhúng 1-Click:** Nhận nhanh Direct Image URL, Markdown `![alt](url)` và HTML tag để chèn vào blog/portfolio.
- 🖼️ **Đa định dạng:** Hỗ trợ JPG, PNG, WEBP, AVIF, HEIC từ điện thoại.

## Chạy thử local

```bash
python3 -m http.server 8000
# Mở trình duyệt: http://localhost:8000
```

## Hướng dẫn kết nối Google Drive

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo một Project mới.
2. Vào **APIs & Services** > Bật **Google Drive API**.
3. Vào **Credentials** > **Create Credentials** > **OAuth client ID**.
4. Chọn loại ứng dụng: **Web application**.
5. Bấm **+ ADD URI** tại mục **Authorized JavaScript origins** và thêm đủ 3 dòng riêng biệt:
   - `https://hoangpham.is-a.dev`
   - `http://localhost:3000`
   - `http://localhost:8000`
   *(Lưu ý: Không để dấu `/` ở cuối các đường dẫn)*
6. Copy **Client ID** dán vào mục *Cấu hình Drive* trên giao diện web.

## License

MIT © [Phạm Quốc Hoàng](https://hoangpham.is-a.dev)
