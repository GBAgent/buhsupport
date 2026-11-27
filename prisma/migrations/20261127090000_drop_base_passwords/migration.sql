-- Пароли от баз 1С на сайте не храним
ALTER TABLE "Base1C" DROP COLUMN IF EXISTS "password";
