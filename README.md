# 售前项目管道管理平台

本仓库已按《售前项目管道管理平台 · 最终方案》完成前端、后端、数据库、部署运维、备份与自动化测试，并增加单管理员登录、会话与 CSRF 防护。前端使用 React 19、TypeScript、Vite 和 Tailwind CSS，支持真实后端 API 与明确启用的浏览器演示模式。

## 已完成能力

- 项目分页、筛选、排序、创建、完整更新、软删除与恢复
- 项目状态流转（机会点识别、方案引导、方案设计、中标），管道列表可直接确认中标
- 多解决方案/多细分关联、中标确认、去重方案统计与下钻；方案推荐产品与已购产品相互独立
- 可维护产品目录（预置 AAD、WAF、CFW、ESA、HSS、NDR、DEW、DSC、SecMaster、DBSS、CBH、安全运营专业服务、大模型防火墙、智能体卫士），支持新增、名称、别名、适用赛道及停用
- HCS/公有云赛道、安全方向分离；按赛道保存字段范围、列偏好及模板；历史不确定值进入迁移待处理
- 最后跟进时间、行动日期/内容、到期提醒及后端分页前行动排序
- 可配置关联字段和“字段值 → 跟进天数”，支持系统分类及自定义文本/选项字段；默认保留固定靶 7／14 天规则，仅提醒未中标活动项目
- 责任人库、Excel/CSV 导入与多人精确匹配；独立 HCS 绑定/状态字段（真实 HCS 接口按用户决定暂留，尚未接通）
- `external_id` 优先、客户名称加项目名称兜底的导入判重
- 手工修改和导入覆盖的字段级变更日志，启用登录时记录登录账号
- 项目详情一次返回基础信息、进展、产品拥有情况、月度收入和修改日志
- 客户维度分析：汇总关联项目、状态分布、已购产品和累计收入，并可下钻项目详情
- 进展时间线新增、查询、软删除和恢复
- 进展严格日历解析、缺年显式默认年份、保留续行、去重及有依据的历史日期修复
- 项目×月份收入批量保存、清空、覆盖及实时汇总
- 按项目、行业、月份、年份进行 SQL 聚合统计
- 字典树 CRUD、行业与子行业及方案与产品三级级联校验、引用删除保护、引用值安全改名
- 自建字典分类，选定字典后用 Excel/CSV 或多行粘贴导入值；先预检再确认，重复值跳过，逐行展示失败原因
- 自定义选项字段可关联自建字典，新增/编辑项目、列表内编辑和项目导入使用实时选项；字典值改名同步项目（含回收站）与修改日志
- 导入映射、导出模板、自定义字段定义的完整配置接口
- 自定义字段文本、数值、日期、选项四种类型校验
- 导入预检和正式执行；每条记录独立事务，坏数据不污染同批其他记录
- 持久后台任务覆盖预检/导入/导出/批量变更：每批100条、最多2个任务、幂等、结果分页、刷新继续查看和中断重试；Excel 解析/生成使用 Worker
- Excel 字段自动优先映射现有字段；产品列使用“已购产品 → 具体产品”二级映射，非空值记为已购
- 未匹配列推断为文本、数字或日期，并在确认正式导入时创建自定义字段
- 项目综合宽表导出：每项目一行，目录产品拆列，项目字段、多方案 JSON、各月收入和全部进展汇成单表；保留明细导出及旧模板
- 项目管道、客户分析、收入矩阵、解决方案统计、导入、导出和系统设置
- 项目管道支持当前页全选及跨页批量删除，删除前确认范围，失败项保留重试；项目移入回收站，收入和进展保留并可随项目恢复
- 回收站支持单个和批量永久删除；仅可硬删除已在回收站中的项目，项目及关联收入、进展、产品记录、修改日志会一并清理，无法从回收站恢复
- 永久删除同时清理旧任务原文及相关导出分块，旧任务重试不能重建项目；失效分块可重试导出剩余项目
- 响应式工作台、项目详情、筛选排序、批量操作与状态反馈
- 默认连接真实后端；仅在明确设置 `VITE_API_MODE=mock` 时启用浏览器演示模式
- 单管理员登录、服务端会话、CSRF 写保护与登录账号审计
- JSON 全量备份、MySQL 每日压缩备份、30 天滚动保留和显式确认恢复
- Docker Compose 一体编排、健康检查、持久化卷和内网访问建议

## 目录

```text
.
├── frontend/                    React 19 / TypeScript / Vite 前端
├── backend/                     Spring Boot 3.5 / Java 17 后端
├── db/init.sql                  MySQL 建库与字符集初始化
├── scripts/demo-data.sql        可重复执行的演示数据
├── scripts/sample-import.json   导入接口示例
├── ops/backup/                  自动备份与恢复脚本
├── backups/                     本机备份落盘目录
├── docs/API.md                  前后端联调契约
├── docker-compose.yml           MySQL + 后端 + 备份服务
└── .env.example                 部署参数模板
```

数据库由 Flyway 增量迁移至 V16；`project_solutions`、`project_responsibles` 保存结构化关系，`product_catalog` 保存动态目录，`batch_jobs`/`batch_job_items` 保存持久任务，`follow_up_policies` 保存关联字段、值规则和默认跟进周期。`project_products` 保存拥有记录；`projects.purchased_products` 保留列表兼容字段并由服务层同步维护。

本轮详见 [交付状态](docs/UPGRADE_STATUS.md)、[操作说明](docs/UPGRADE_GUIDE.md)、[验收报告](docs/ACCEPTANCE.md)、[性能对比](docs/PERFORMANCE.md)、[HCS 遗留边界](docs/HCS_INTEGRATION.md)。字段对照和两套本地项目导入模板位于 `docs/deliverables/`。

2026-10-29 新增字段关联跟进提醒，可在“配置 → 跟进提醒”自由选择关联字段和周期，详见 [跟进提醒说明](docs/FOLLOW_UP_REMINDERS.md)。原固定靶规则自动保留，不修改项目数据。原导入模板仍有效，可增加“是否固定靶”“项目级别”列，自动映射到系统字段。

自定义字典的使用顺序：在“系统设置 → 字典管理”创建字典并导入值，再在“自定义字段”中新增或编辑“选项”字段，将选项来源切换为该字典。可选字段允许先关联空字典；必填字段需先配置字典值。已有手填选项字段不会自动关联，绑定时会先检查原项目值是否与字典一致。自建字典为单层选项，现有行业与方案/产品层级不变。

## 前端启动与构建

要求：Node.js 22、npm 10。

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

默认 `VITE_API_MODE=http` 并连接真实后端：

```dotenv
VITE_API_MODE=http
```

同时确保后端运行在 `http://localhost:8080`。Vite 会把 `/api` 请求代理到后端。如需纯前端演示，可明确改为 `VITE_API_MODE=mock`；此模式的数据只保存在当前浏览器中。

也可以使用仓库内置的演示模式启动命令，无需修改环境文件：

```bash
npm run dev:demo
```

新初始化的演示模式包含多方案、动态产品、责任人、HCS/公有云、逾期/今天/明天/7天/未安排等示例，不会覆盖现有浏览器演示业务数据，也不修改正式后端库。演示 HCS 状态不是实际接口返回。

生产构建与单独类型检查：

```bash
npm run build
npm run typecheck
```

构建产物写入 `frontend/dist/`，该目录和 `node_modules/` 均不会提交到 Git。

## Docker 快速启动

Docker Compose 当前负责启动 MySQL、后端和自动备份服务；前端可按上一节单独启动。要求 Docker Engine 24+，并支持 `docker compose`。

1. 复制环境模板。

   ```bash
   cp .env.example .env
   ```

2. 修改 `.env` 中的数据库密码及 `APP_AUTH_USERNAME`、`APP_AUTH_PASSWORD`。管理员密码至少 12 个字符；缺少登录配置时后端会拒绝启动。仅限本机临时免登录时可设置 `APP_AUTH_ENABLED=false`，对外或内网共享前必须恢复为 `true`。

3. 构建并启动。

   ```bash
   docker compose up -d --build
   ```

4. 检查状态。

   ```bash
   docker compose ps
   curl http://127.0.0.1:8080/actuator/health
   ```

健康响应为 `{"status":"UP"}` 即可。API 从 `/api` 开始。

### 灌入演示数据

```bash
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -upresales presales_pipeline' \
  < scripts/demo-data.sql
```

脚本可重复执行，不会重复创建示例项目和模板。

### 停止与更新

```bash
docker compose down
docker compose up -d --build
```

普通 `docker compose down` 不会删除数据库卷。不要执行 `docker compose down -v`，除非已经确认要永久删除全部数据库数据。

## 非 Docker 启动

要求：JDK 17、Maven 3.9、MySQL 8。

先创建 `presales_pipeline` 数据库和数据库账号，再设置：

```bash
export DB_URL='jdbc:mysql://127.0.0.1:3306/presales_pipeline?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false'
export DB_USERNAME='presales'
export DB_PASSWORD='你的数据库密码'
export APP_AUTH_ENABLED='true'
export APP_AUTH_USERNAME='admin'
export APP_AUTH_PASSWORD='至少十二个字符的独立密码'
```

然后打包运行：

```bash
cd backend
mvn clean package
java -jar target/presales-pipeline-1.0.0.jar
```

Flyway 会在首次启动时自动建表并写入基础字典。

## API 约定

所有业务接口统一返回：

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

- `code = 0` 表示成功。
- 参数错误使用 HTTP 400，数据冲突使用 409，资源不存在使用 404。
- 金额单位统一为万元，数据库精度为 `DECIMAL(18,2)`。
- 月份必须使用 `YYYY-MM`，业务时区统一为 `Asia/Shanghai`。
- 除 `/api/auth/csrf`、登录入口和健康检查外，业务接口必须登录后访问。
- 写操作需要有效 CSRF 令牌；前端会自动获取和提交。
- 变更日志的操作人取当前登录账号；没有安全上下文的后台任务才使用 `APP_OPERATOR` 兜底值。

完整接口、参数和导入格式见 [docs/API.md](docs/API.md)。

## 导入流程

Excel 的读取、列映射和值映射属于前端职责；前端会按合并单元格还原多级表头，后端接收转换后的 JSON。

1. 前端先提交 `dryRun: true`，后端合并已有项目后返回新增、覆盖、待处理数量、Excel 原行号和逐字段问题；预检不创建项目或字段。
2. 预检页可批量补客户、将非标准值对照到现有选项、逐行修正。确认后只提交已通过的记录，成功行自动从列表移除，待处理行继续保留并可下载清单。不想导入的行可勾选批量删除，仅移出本次导入清单，可在当前页面恢复；不会删除已有项目。标准值对照可保存到映射方案复用，不会扩充字典。
3. 后端按外部编号优先判重，没有外部编号时按客户名称加项目名称判重。
4. `fields` 中未出现的字段在覆盖时保持原值；出现且为 `null` 或空字符串时会清空。`customFields` 使用合并语义，空值会删除对应自定义字段值。
5. 同一导入批次内的重复项目只处理首次通过校验的记录，失败行不会占用后续行的判重标识。
6. 每条记录使用独立事务，某一行校验失败不会留下半条数据，也不会阻断其他有效记录。
7. 仅明确的已购产品列选择具体目录产品，非空表示已购；需求洞察产品列保留需求原义，不转为已购。
8. 待新增自定义字段随导入请求提交，仅在成功行正式写入时创建；单行修正优先于批量修改。待处理进度保存在当前页面，离开或刷新前请下载清单。

可直接使用 [scripts/sample-import.json](scripts/sample-import.json) 调用 `/api/import`。

## 备份与恢复

### 自动 MySQL 备份

`backup` 服务启动后会立即生成首份备份，之后默认每 86400 秒执行一次。文件写入 `backups/`，命名为：

```text
presales-pipeline-YYYYMMDD-HHMMSS.sql.gz
```

默认保留 30 天，可在 `.env` 中修改 `BACKUP_INTERVAL_SECONDS` 和 `BACKUP_RETENTION_DAYS`。

### 一键 JSON 全量导出

访问：

```text
GET /api/backup
```

会下载包含 19 张表、软删除记录、完整修改日志、后台任务及跟进规则的 JSON。它适合快速留档；灾难恢复优先使用 MySQL 压缩备份。

### 恢复 MySQL 备份

恢复会覆盖当前同名表中的数据，建议先停止写入服务并再次备份：

```bash
docker compose stop backend backup
CONFIRM_RESTORE=YES ./ops/backup/restore.sh backups/presales-pipeline-YYYYMMDD-HHMMSS.sql.gz
docker compose start backend backup
```

恢复脚本没有 `CONFIRM_RESTORE=YES` 时会拒绝执行。

## 登录与内网访问控制

系统默认使用 `.env` 中的单管理员账号登录。仅当服务绑定在本机地址时，可临时设置 `APP_AUTH_ENABLED=false` 免登录使用；对外或内网共享前必须恢复为 `true`。Docker 默认只监听 `127.0.0.1`；如需改为内网共享，仍建议至少满足以下一项：

- 只部署在受控内网；
- 将 `APP_BIND_ADDRESS` 设为 `127.0.0.1`，再由 nginx 暴露并限制来源 IP；
- 在主机或边界防火墙中只允许办公网段访问应用端口。

nginx 白名单示例：

```nginx
server {
    listen 80;
    server_name presales.internal;

    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 前后端一体化打包（可选）

执行 `frontend/npm run build` 后，将 `frontend/dist/` 中的构建产物复制到：

```text
backend/src/main/resources/static/
```

重新构建 jar 或 Docker 镜像。后端已支持无扩展名的 SPA 路由回退，并继续保留 `/api/**` 与 `/actuator/**`。

## 验证

后端测试覆盖完整业务主链、未登录拦截、登录会话和 CSRF 防护：

```bash
cd backend
mvn test
mvn clean package
```

前端验证：

```bash
cd frontend
npm test
npm run typecheck
npm run build
```

GitHub Actions 会在每次推送和 Pull Request 时自动执行前端依赖审计、测试、生产构建和后端测试。
