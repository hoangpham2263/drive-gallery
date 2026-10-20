# Hoang's Memories

Bản đồ hành trình: những nơi đã đi qua ở Việt Nam, lưu lại bằng ảnh.

**Website:** https://hoangpham.is-a.dev/memories/

## Tính năng

- Bản đồ Việt Nam **34 tỉnh, thành phố** (sau sáp nhập 2025), có quần đảo Hoàng Sa và Trường Sa. Tỉnh đã đến được tô màu, đếm "Đã đến x/34".
- Bấm vào tỉnh để xem ảnh ở nơi đó; dòng thời gian theo tháng.
- Upload ảnh (chế độ quản lý): đọc GPS và ngày chụp từ EXIF, tự gán tỉnh; ảnh không có GPS thì chọn tỉnh. Hỗ trợ HEIC, tự nén về tối đa 2560px.
- Ảnh lưu trong Google Drive (thư mục riêng), qua Cloudflare Worker giữ kết nối lâu dài — không phải đăng nhập lại.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.html`, `style.css`, `app.js` | Giao diện |
| `vn-34.json` | Ranh giới 34 tỉnh, thành phố (gộp từ 63 tỉnh cũ theo Nghị quyết 202/2025/QH15) |
| `vendor/exifr.full.umd.js` | Đọc EXIF / GPS |
| `worker/` | Cloudflare Worker: Google Drive, danh sách ảnh (KV), proxy ảnh |

## Cài đặt Worker (một lần)

1. Google Cloud Console → bật **Google Drive API** → tạo **OAuth client ID** loại *Web application*, thêm Authorized redirect URI:
   `https://memories-api.hoangpham2263.workers.dev/oauth/callback`
2. OAuth consent screen → **Publish app** (In production) để refresh token không hết hạn sau 7 ngày.
3. Đặt secrets:

```bash
cd worker
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ADMIN_PASSWORD
npx wrangler deploy
```

4. Mở trang, bấm biểu tượng ổ khóa, nhập mật khẩu quản lý → trang tự mở bước kết nối Google Drive.

## Công nghệ

HTML, CSS, JavaScript thuần · Leaflet · exifr · heic2any · GitHub Pages · Cloudflare Workers + KV · Google Drive API
