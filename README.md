# 彩虹聚合 DNS 管理系统（DNScaihong）

这是基于[彩虹聚合 DNS 管理系统官方项目](https://github.com/netcccyun/dnsmgr)整理的可部署版本，保留原项目的 MIT License，并包含操作日志管理增强。

## 本版本的修改

- 操作日志支持管理员单条删除。
- 支持按日志 ID 指定删除。
- 支持勾选后批量删除。
- 支持“仅保留最近 7 天”：清理 7 天以前的日志，保留最近 7×24 小时的记录。
- 删除接口只允许管理员使用，普通用户只能按原有权限查看日志。
- 解析记录导入支持 Excel、CSV/TSV、TXT 表格、BIND Zone 和 JSON，可识别常见服务商导出字段并映射解析线路。使用说明见 [docs/RECORD_IMPORT.md](docs/RECORD_IMPORT.md)。
- 源码包已移除服务器 `.env`、运行时缓存、数据库内容、服务器日志和站点配置。

## 功能概览

彩虹聚合 DNS 管理系统基于 ThinkPHP，可在一个后台管理多个 DNS 服务商的域名解析，并提供多用户权限、容灾切换、定时切换、Cloudflare 优选 IP、SSL 证书申请与部署、通知等功能。具体功能以官方项目为准。

## 环境要求

- PHP 8.0 或更高版本。
- MySQL 5.6 或更高版本。
- Composer 2。
- PHP 的 PDO、CURL、OpenSSL、Mbstring、JSON 等扩展。
- Nginx 或 Apache，并将站点运行目录设为 `public`。

## 快速安装

完整步骤见 [docs/INSTALL.md](docs/INSTALL.md)。简要流程如下：

```bash
git clone https://github.com/xcxcadc/DNScaihong.git
cd DNScaihong
composer install --no-dev --optimize-autoloader
cp .example.env .env
```

编辑 `.env` 填写数据库连接信息，配置 Web 服务器后访问 `/install`，根据页面提示完成安装。`.env` 只保存在服务器上，不要提交到 Git。

## 卸载

卸载前请先备份数据库。完整的安全卸载步骤见 [docs/UNINSTALL.md](docs/UNINSTALL.md)。卸载只应删除本项目的站点目录、定时任务和数据库，不要删除共享的 PHP、MySQL、Nginx 或 DNS 服务。

## Nginx 伪静态

站点根目录必须是项目的 `public` 目录。官方项目使用以下 ThinkPHP 规则：

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

如果环境使用独立的 `fastcgi.conf`，请确认其中包含 `SCRIPT_FILENAME`，例如：

```nginx
fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
```

## 脱敏和发布约定

- `.env`、数据库导出文件、运行时缓存、日志、证书、私钥和服务器配置不属于源码仓库。
- 生产环境的 DNS 服务商密钥、通知 Token、API 密钥只在后台配置，不写入代码。
- 发布前请检查 `git diff --cached` 和仓库的 Secret scanning 结果。

## 参考与许可

- 上游项目：[netcccyun/dnsmgr](https://github.com/netcccyun/dnsmgr)
- 上游安装说明和功能说明以上游仓库为参考。
- 本项目遵循仓库中 [MIT License](LICENSE)。
