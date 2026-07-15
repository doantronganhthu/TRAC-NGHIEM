# Quy tắc dự án (Project Instructions)

## 1. Màn hình khóa (Lock Screen / Gateway Screen)
* **Khái niệm**: "Màn hình khóa" là màn hình trung gian thông báo chuyển hướng tên miền sang `https://tracnghiem-dta.vercel.app/` trước khi người dùng vào màn hình đăng nhập chính.
* **Mã mở khóa**: Có một ô hình con nhộng nhỏ ở góc trên cùng bên phải không có nội dung, khi nhập đúng mã `9630anh` thì sẽ bỏ qua màn hình khóa này và vào màn hình sử dụng bình thường.
* **Trạng thái lưu trữ**: Trạng thái mở khóa được lưu trong `localStorage` với key `gateway_unlocked`.

## 2. Các yêu cầu bật/tắt màn hình khóa
* **Khi có yêu cầu "bỏ màn hình khóa"**: Người dùng muốn ẩn hoàn toàn màn hình khóa trung gian này đi để vào thẳng màn hình nhập tên thí sinh bình thường. Khi đó, đại lý (Agent) cần chỉnh sửa code trong `src/App.tsx` để xóa/bỏ qua điều kiện kiểm tra `!gatewayUnlocked` (hoặc đặt giá trị mặc định của `gatewayUnlocked` luôn là `true`), giữ nguyên toàn bộ giao diện và chức năng còn lại.
* **Khi có yêu cầu "thêm màn hình khóa"**: Người dùng muốn khôi phục lại màn hình khóa trung gian này. Khi đó, đại lý (Agent) cần thêm lại khối JSX của màn hình khóa sử dụng trạng thái `!gatewayUnlocked` cùng với ô nhập mã góc trên bên phải để hoạt động bình thường.
