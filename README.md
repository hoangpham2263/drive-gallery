# Drive Gallery

Quản lý, lưu trữ ảnh trên **Google Drive** — tự động trích xuất thông số máy ảnh (EXIF), toạ độ GPS và chuyển đổi thành **tên địa danh thực tế**, tạo link nhúng nhanh (Direct URL, Markdown, HTML).

**Dùng thử:** https://hoangpham.is-a.dev/drive-gallery/

## Tính năng nổi bật

- **Lưu trữ Google Drive:** Kết nối trực tiếp tài khoản Google của bạn qua OAuth 2.0 (Google Identity Services). Ảnh lưu trong thư mục riêng, không qua server trung gian.
- **Trích xuất vị trí & Địa danh (GPS Reverse Geocoding):** Tự động đọc toạ độ GPS từ ảnh chụp và định vị ra tên địa điểm thực tế (ví dụ: *Hoàn Kiếm, Hà Nội*). Hỗ trợ nút mở vị trí trên Google Maps.
- **Đọc thông số kỹ thuật (EXIF):** Thiết bị chụp (iPhone, Canon, Sony...), khẩu độ (f-stop), tốc độ màn trập, ISO, tiêu cự, ngày giờ chụp gốc.
- **Tạo link nhúng 1-Click:** Nhận nhanh Direct Image URL, cú pháp Markdown `![alt](url)` và thẻ HTML `<img ... />` để chèn vào blog/website.
- **Xem dạng lưới (Gallery Grid) & Lightbox:** Phóng to xem ảnh sắc nét kèm thanh thông tin chi tiết (Info Panel).
- **Tìm kiếm & Phân loại:** Lọc theo thư mục/album, tìm theo tên, địa danh hoặc thiết bị chụp.
- **Hỗ trợ đa định dạng:** JPG, PNG, WEBP, AVIF, HEIC từ điện thoại.
- **Chế độ Demo:** Trải nghiệm ngay các tính năng mà chưa cần cấu hình Google Drive.

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
