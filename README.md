# 售前项目管道管理平台

本仓库已按《售前项目管道管理平台 · 最终方案》完成前端、后端、数据库、部署运维、备份与自动化测试，并增加单管理员登录、会话与 CSRF 防护。前端使用 React 19、TypeScript、Vite 和 Tailwind CSS，支持真实后端 API 与明确启用的浏览器演示模式。

## 已完成能力

- 项目分页、筛选、排序、创建、完整更新、软删除与恢复
- 项目状态流转（机会点识别、方案引导、方案设计、中标），管道列表可直接确认中标
- 解决方案、细分解决方案、固定产品三级关联配置；中标时强制确认并支持多选已购产品
- 固定产品目录（AAD、WAF、CFW、ESA、HSS、NDR、DEW、DSC、SecMaster、DBSS、CBH、安全运营专业服务、大模型防火墙、智能体卫士）及项目产品关系表
- `external_id` 优先、客户名称加项目名称兜底的导入判重
- 手工修改和导入覆盖的字段级变更日志，操作人当前固定为“我”
- 项目详情一次返回基础信息、进展、产品拥有情况、月度收入和修改日志
- 客户维度分析：汇总关联项目、状态分布、已购产品和累计收入，并可下钻项目详情
- 进展时间线新增、查询、软删除和恢复
- 项目×月份收入批量保存、清空、覆盖及实时汇总
- 按项目、行业、月份、年份进行 SQL 聚合统计
- 字典树 CRUD、行业与子行业及方案与产品三级级联校验、引用删除保护、引用值安全改名
- 导入映射、导出模板、自定义字段定义的完整配置接口
- 自定义字段文本、数值、日期、选项四种类型校验
- 导入预检和正式执行；每条记录独立事务，坏数据不污染同批其他记录
- Excel 字段自动优先映射现有字段；产品列使用“已购产品 → 具体产品”二级映射，非空值记为已购
- 未匹配列推断为文本、数字或日期，并在确认正式导入时创建自定义字段
- 主表、收入、进展三类模板化 JSON 导出，供前端生成 xlsx
- 项目管道、客户分析、收入矩阵、导入、导出和系统设置六类前端页面
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

数据库由 Flyway 自动创建 9 张业务表，其中 `project_products` 按项目和产品保存独立拥有记录；`projects.purchased_products` 保留为列表查询兼容字段，并由服务层同步维护。

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

演示模式包含项目各状态、方案三级关联、固定产品、中标项目、客户汇总、收入和进展等完整示例数据。演示数据使用独立的浏览器存储版本，不会读取或修改正式后端数据库。

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

1. 前端先提交 `dryRun: true`，后端返回新增、覆盖、跳过数量和逐行原因。
2. 用户确认后用相同记录提交 `dryRun: false`。
3. 后端按外部编号优先判重，没有外部编号时按客户名称加项目名称判重。
4. `fields` 中未出现的字段在覆盖时保持原值；出现且为 `null` 或空字符串时会清空。`customFields` 使用合并语义，空值会删除对应自定义字段值。
5. 同一导入批次内的重复项目只处理第一次出现的记录。
6. 每条记录使用独立事务，某一行校验失败不会留下半条数据，也不会阻断其他有效记录。
7. 固定产品独立列在映射时选择具体产品；该列单元格非空即表示已购，空值表示未购。

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

会下载包含 8 张表、软删除记录和完整修改日志的 JSON。它适合快速留档；灾难恢复优先使用 MySQL 压缩备份。

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
