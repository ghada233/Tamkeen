# استخدم صورة Nginx الأساسية
FROM nginx:latest

# انسخ جميع ملفات المشروع إلى مجلد Nginx الافتراضي
COPY . /usr/share/nginx/html

# فتح المنفذ 80 لتشغيل الخادم
EXPOSE 80

# بدء Nginx عند تشغيل الحاوية
CMD ["nginx", "-g", "daemon off;"]
