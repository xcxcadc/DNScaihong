# 安装教程

本文参考彩虹聚合 DNS 管理系统官方仓库的自部署说明，并补充本版本的日志功能说明。官方项目地址：[netcccyun/dnsmgr](https://github.com/netcccyun/dnsmgr)。

## 1. 准备环境

建议使用 Debian、Ubuntu 或宝塔等常见 PHP 环境，并准备：

- PHP 8.0+。
- MySQL 5.6+。
- Composer 2。
- Nginx 或 Apache。
- PDO、PDO_MySQL、CURL、OpenSSL、Mbstring、JSON 等 PHP 扩展。

确认版本：

```bash
php -v
composer --version
mysql --version
```

## 2. 获取源码并安装依赖

```bash
cd /var/www
git clone https://github.com/xcxcadc/DNScaihong.git dnscaihong
cd /var/www/dnscaihong
composer install --no-dev --optimize-autoloader
```

如果服务器没有 Composer，请先按 Composer 官方文档安装。不要把 `vendor/` 依赖目录替换成其他项目的目录。

## 3. 创建数据库

创建一个专用数据库和专用用户，密码请换成随机强密码：

```sql
CREATE DATABASE dnscaihong CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dnscaihong'@'127.0.0.1' IDENTIFIED BY '请替换为随机强密码';
GRANT ALL PRIVILEGES ON dnscaihong.* TO 'dnscaihong'@'127.0.0.1';
FLUSH PRIVILEGES;
```

不要使用公开教程中的示例密码作为生产密码。

## 4. 配置环境文件

```bash
cd /var/www/dnscaihong
cp .example.env .env
chmod 600 .env
```

编辑 `.env`，填写数据库主机、数据库名、用户名、密码、端口和表前缀。`.env` 已被 `.gitignore` 忽略，不能提交到 GitHub。

## 5. 配置 Nginx

将站点根目录设置为：

```text
/var/www/dnscaihong/public
```

ThinkPHP 伪静态规则：

```nginx
location ~* (runtime|application)/ {
    return 403;
}

location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=$1 last;
        break;
    }
}
```

PHP-FPM 配置需要包含：

```nginx
fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
```

检查并加载配置：

```bash
nginx -t
systemctl reload nginx
```

Apache 用户请参考上游仓库的 `.htaccess` 和伪静态说明。

## 6. 设置目录权限

将 `runtime` 目录设置为 Web 服务用户可写。下面以 Debian 常见的 `www-data` 为例；宝塔环境通常使用 `www`，请按实际 PHP-FPM 用户替换：

```bash
mkdir -p /var/www/dnscaihong/runtime
chown -R www-data:www-data /var/www/dnscaihong/runtime
chmod -R u+rwX /var/www/dnscaihong/runtime
```

## 7. 完成网页安装

访问：

```text
https://你的域名/install
```

按页面提示检查环境、填写数据库连接、创建管理员账号并完成初始化。安装完成后访问首页登录后台。

## 8. 日志功能

管理员进入“操作日志”后可以：

- 单条删除日志。
- 输入一个或多个 ID 指定删除。
- 勾选后批量删除。
- 使用“仅保留最近7天”清理 7 天以前的日志。

“仅保留最近7天”按照应用时区 `Asia/Shanghai` 计算当前时间往前 7×24 小时。删除接口在服务器端再次校验管理员权限。

## 9. 安装后检查

```bash
curl -I https://你的域名/
php -l app/controller/User.php
```

确认 `.env` 没有被 Web 服务器直接下载，并确认站点只使用 HTTPS。定时任务或容灾任务如需启用，请按后台设置和上游文档单独配置。
