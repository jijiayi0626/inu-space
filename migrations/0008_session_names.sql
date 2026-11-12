-- 允许用户为登录会话设置易读名称。
ALTER TABLE sessions ADD COLUMN name TEXT;
