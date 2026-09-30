# 卸载教程

卸载前先确认站点目录、数据库名和定时任务都属于本项目。以下命令中的路径和名称都是示例，执行前请替换为你实际确认过的值。

## 1. 备份数据

如果还需要保留域名、账户或证书配置，先备份数据库：

```bash
mysqldump --single-transaction -h 127.0.0.1 -u 数据库用户 -p 数据库名 > dnscaihong-backup.sql
```

同时保存 `.env`、Nginx 站点配置和你自己维护的定时任务清单。备份文件不要上传到公开仓库。

## 2. 停止项目任务

在后台或服务器任务管理器中停止本项目的容灾切换、定时切换、证书任务和其他以本项目目录为工作目录的任务。只停止确认属于本项目的任务，不要停止整台服务器的通用 DNS、Nginx、MySQL 或 PHP 服务。

如果你单独创建过 systemd、Supervisor 或 Cron 任务，请先删除这些任务，然后重新加载对应服务配置。

## 3. 删除 Web 站点配置

删除指向本项目 `public` 目录的 Nginx 或 Apache 站点配置，并先检查配置：

```bash
nginx -t
systemctl reload nginx
```

如果站点与其他项目共用 Nginx 配置，只删除本项目对应的 `server` 块。

## 4. 删除程序文件

确认路径只指向本项目目录后再删除。例如：

```bash
APP_DIR=/var/www/dnscaihong
test -f "$APP_DIR/public/index.php"
rm -rf -- "$APP_DIR"
```

不要把 `/var/www`、`/www`、服务器根目录或其他项目目录作为删除目标。

## 5. 删除数据库（可选）

只有在确认不再需要数据时才执行：

```sql
DROP DATABASE dnscaihong;
DROP USER 'dnscaihong'@'127.0.0.1';
FLUSH PRIVILEGES;
```

如果服务器上的 MySQL 还被其他项目使用，只删除本项目专用数据库和用户。

## 6. 卸载后的检查

```bash
systemctl status nginx
systemctl status mysql
```

确认其他站点、DNS 服务、数据库和服务器任务仍按预期运行。保留的数据库备份应存放在公开仓库之外，并按你的备份策略加密保存。
