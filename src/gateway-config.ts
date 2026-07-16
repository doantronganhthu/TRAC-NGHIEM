/**
 * CẤU HÌNH MÀN HÌNH KHÓA (GATEWAY LOCK SCREEN)
 * 
 * Hướng dẫn tự thay đổi:
 * - Thay đổi giá trị dưới đây thành false để TẮT màn hình khóa (vào thẳng trang web bình thường).
 * - Thay đổi giá trị dưới đây thành true để BẬT màn hình khóa (thông báo chuyển hướng sang tên miền vercel).
 * 
 * Ví dụ:
 * export const IS_GATEWAY_ENABLED = true;  // Bật màn hình khóa
 * export const IS_GATEWAY_ENABLED = false; // Tắt màn hình khóa
 */
export const IS_GATEWAY_ENABLED = false;
