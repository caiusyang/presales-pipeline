# API 联调契约

基础地址：`/api`。所有响应均为 `{code, message, data}`。默认情况下，除获取 CSRF 令牌和登录外，业务接口均要求已登录的服务端会话；所有 POST、PUT、PATCH、DELETE 请求需要提交 CSRF 请求头。仅本机运行可通过 `APP_AUTH_ENABLED=false` 临时关闭登录和 CSRF，禁止在对外或内网共享时使用该设置。

## 登录

1. `GET /api/auth/csrf` 获取 `headerName` 和 `token`，并保持响应建立的会话。
2. `POST /api/auth/login` 使用 `application/x-www-form-urlencoded` 提交 `username`、`password`，同时按上一步的 `headerName` 提交令牌。
3. `GET /api/auth/me` 获取当前账号和角色。
4. `POST /api/auth/logout` 退出登录，同样需要 CSRF 请求头。

未登录访问业务接口返回 HTTP 401；缺少或使用无效 CSRF 令牌返回 HTTP 403。

## 项目

### `GET /api/projects`

查询参数：

| 参数 | 说明 |
|---|---|
| `industry` / `track` / `projectStatus` / `keyword` | 行业、赛道、项目状态、关键字筛选 |
| `startMonth` / `endMonth` | `YYYY-MM`；筛选期间有收入的项目，并按该期间计算 `revenueTotal` |
| `page` / `size` | 从 0 开始；每页 1～200 条 |
| `sortBy` | 默认 `actionPriority`，或 `id/customerName/projectName/projectStatus/industry/track/createdAt/updatedAt` |
| `actionRange` | `overdue/today/next7/unscheduled`，均在分页前筛选 |
| `solution` / `subSolution` | 按结构化方案关系筛选 |
| `responsibleId` / `hcsStatus` | 责任人编号 / 独立 HCS 状态筛选 |
| `sortDirection` | `asc` 或 `desc` |
| `deleted` | `false` 查活动项目，`true` 查回收站 |

### `POST /api/projects`

### `PUT /api/projects/{id}`

两个接口使用相同完整对象：

```json
{
  "externalId": "CRM-001",
  "customerName": "示例客户",
  "projectName": "数据安全治理",
  "projectStatus": "中标",
  "securityBudget": 500.00,
  "solution": "安全咨询",
  "subSolution": "数据安全规划",
  "purchasedProducts": ["DSC", "DEW"],
  "track": "公有云",
  "securityDirection": "数据安全",
  "solutions": [{"solution":"安全咨询","subSolutions":["数据安全规划"]}],
  "nextActionDate": "2026-11-01",
  "nextActionNote": "确认方案",
  "industry": "金融",
  "subIndustry": "银行",
  "scenario": "核心数据治理",
  "keyRisks": "口径待统一",
  "keyNeeds": "形成路线图",
  "customFields": {
    "stage": "方案"
  }
}
```

`projectStatus` 仅支持 `机会点识别`、`方案引导`、`方案设计`、`中标`，省略默认`机会点识别`。中标要求至少一组完整有效的 `solutions` 方案/细分和一个已购产品；状态回退保留信息。省略 `solutions` 的旧请求可由 `solution/subSolution` 转为一项，显式 `[]` 表示清空。产品编码从 `/config/products` 读取，不再固定。赛道可空（待分类），非空只支持 HCS、公有云。`lastFollowUpAt`、`hcsStatus`、`lastSyncAt` 为只读；可写 `hcsOpportunityId` 和手工 `responsibleIds`（更新省略保留，空数组清空手工关联，不影响 HCS 来源）。

### 本轮新增接口

| 接口 | 用途 |
| --- | --- |
| `POST /projects/{id}/complete-action` | `{nextActionDate:null,nextActionNote:"已完成"}` 清空或安排下一次 |
| `GET /stats/solutions` | 方案/细分内去重计数、本地状态分布、中标和客户数，不分摊收入 |
| `GET/POST /config/products`、`PUT /config/products/{id}` | 产品目录：code/name/aliases/applicableTracks/sortOrder/enabled；编码不能改 |
| `GET/POST /config/people`、`PUT /config/people/{id}` | 责任人库：name/employeeNo/account/aliases/enabled |
| `POST /config/people/import` | `{requestId,people:[...]}` 返回后台任务 |
| `POST /config/people/match` | 多个 `{employeeNo,account,name,role}`，返回所有唯一命中和歧义项 |
| `GET /progress/repair?page=0&size=100&projectId=...` | 依据原文完整日期生成历史修复预览 |
| `POST /progress/repair/jobs` | `{requestId,repairs:[{id,expectedLogDate,expectedContent,logDate,content,evidence}]}` |
| `GET /migration-issues` | 迁移待处理原值、项目及原因 |

`CustomField` 增加 `applicableTracks:[]`（空数组为公共）；导入映射/导出模板增加可空的 `applicableTrack`。

### 持久后台任务

- `POST /projects/batch`：`{requestId,operation:"delete|restore|purge",projectIds:[...]}`，最多5000个，去重。
- `POST /import/jobs`：`{requestId,request:{dryRun,records,pendingFields,mappingId}}`。
- `POST /export/jobs`：`{requestId,request:{scope,columns,filters,templateId}}`。
- `GET /jobs`、`GET /jobs/{id}`：任务进度；`GET /jobs/{id}/items?page=0&size=100`：逐项结果；`GET /jobs/{id}/result`：聚合结果。
- `POST /jobs/{id}/retry`：`{requestId}`，成功项不重跑；同一重试标识不重复排队。

受理返回任务视图（id/kind/status/total/processed/succeeded/failed/error/createdAt/updatedAt），不是业务结果。状态为 QUEUED/RUNNING/SUCCEEDED/PARTIAL/FAILED/INTERRUPTED。唯一 requestId 重复提交相同内容返回原任务，不同内容返回409。单项事务同时提交业务与成功标记。每批100条，最多2个并行；重启标中断。导出必须全部分块成功才能下载，硬删除导致分块快照清理后，需先重试剩余项目。任务原文同样进入备份及永久删除清理范围。

当前没有真实 HCS 网络同步入口，详见 `HCS_INTEGRATION.md`，不要把人员匹配接口当作 HCS 已联调。

### `GET /api/projects/{id}/detail`

一次返回 `project`、`progress`、`products`、`revenues`、`changeLogs`。`products` 为 `project_products` 关系表中的已购记录，包含 `id`、`projectId`、`productCode`、`createdAt`、`updatedAt`。

### `DELETE /api/projects/{id}`

软删除项目。

管道列表的批量删除复用该接口，按明确勾选的项目 ID 执行，每批最多 4 个并发请求；每个项目沿用独立事务与修改日志。前端分别展示成功和失败结果，成功项取消勾选并刷新项目、客户及收入统计，失败项保留以供核对重试。分页和排序保留选择，改变筛选条件或每页条数时清空选择；表头全选仅覆盖当前页。删除不会清除项目收入明细、进展或产品记录，可通过恢复接口找回。无需新增批量 API，旧后端可直接使用。

### `POST /api/projects/{id}/restore`

恢复项目；若已存在同客户同名活动项目则返回 409。

### `DELETE /api/projects/{id}/permanent`

永久删除回收站中的项目。项目不存在返回 404；项目仍在活动列表或已被恢复时返回 409，且不会清理任何关联数据。项目、收入明细（含已软删除记录）、进展日志（含已软删除记录）、`project_products` 和修改日志在同一事务中物理删除；失败时全部回滚。硬删除与恢复均锁定项目行，避免恢复与永久删除并发时误删活动项目。不会清理字典、字段定义或模板。

前端回收站提供单个“永久删除”及跨页勾选“批量永久删除”，确认框明确显示项目名称、数量和不可恢复的影响。批量操作复用此接口，最多 4 个并发；成功项移出列表，失败项保留并显示原因，不会自动重试，也不会自动将活动项目移入回收站。鉴权和 CSRF 规则沿用其他写接口。正式使用前需更新并重启后端加载该新接口，无需数据库结构迁移。

## 客户分析

### `GET /api/customers`

按客户名称汇总所有活动项目。可传 `keyword` 搜索客户名称、项目名称、项目外部编号或已购产品。客户名称匹配不区分大小写，软删除项目不参与统计。

```json
{
  "code": 0,
  "message": "成功",
  "data": [
    {
      "customerName": "示例客户",
      "projectCount": 2,
      "wonProjectCount": 1,
      "statusCounts": {
        "机会点识别": 0,
        "方案引导": 1,
        "方案设计": 0,
        "中标": 1
      },
      "purchasedProducts": ["WAF", "HSS"],
      "revenueTotal": 320.00,
      "updatedAt": "2026-09-13T10:30:00",
      "projects": [
        {
          "id": 1,
          "externalId": "CRM-001",
          "projectName": "云安全建设",
          "projectStatus": "中标",
          "industry": "金融",
          "track": "云安全",
          "solution": "云安全解决方案",
          "subSolution": "边界安全",
          "purchasedProducts": ["WAF", "HSS"],
          "revenueTotal": 320.00,
          "updatedAt": "2026-09-13T10:30:00"
        }
      ]
    }
  ]
}
```

客户按累计收入降序排列，已购产品在客户下跨项目去重；`projects` 按最近更新时间降序排列。

## 进展

- `GET /api/progress?projectId={id}`：项目时间线；不传项目 ID 时返回全部活动项目进展。
- `POST /api/progress`：新增。
- `DELETE /api/progress/{id}`：软删除。
- `POST /api/progress/{id}/restore`：恢复。

```json
{
  "projectId": 1,
  "logDate": "2026-08-18",
  "content": "完成首次需求访谈"
}
```

## 收入

### `GET /api/revenues`

返回项目×月份矩阵。可使用 `year=2026`，或同时传 `startMonth`、`endMonth`；两种方式不能混用。可附加行业、赛道和关键字筛选。

### `PUT /api/revenues`

批量保存。相同项目和月份会覆盖；`amount: null` 表示清空该单元格；金额为 0 时会保留 0 元记录。

```json
{
  "entries": [
    {"projectId": 1, "month": "2026-08", "amount": 120.00},
    {"projectId": 1, "month": "2026-09", "amount": null}
  ]
}
```

单批最多 5000 个单元格，同批不得重复提交同一项目月份。

## 收入统计

`GET /api/stats/revenue?dim=project&year=2026`

`dim` 支持：

- `project`：按项目；
- `industry`：按行业；
- `month`：按月份；
- `year`：按年份。

聚合直接在 SQL 中完成，返回 `items` 与 `total`。

## 字典

- `GET /api/dictionaries?type=industry`：行业→子行业树。
- `GET /api/dictionaries?type=solution`：解决方案→细分解决方案→产品三级树。
- `POST /api/dictionaries`：创建。
- `PUT /api/dictionaries/{id}`：修改；改名会同步更新所有引用项目并写修改日志。
- `DELETE /api/dictionaries/{id}`：软删除；有下级或项目引用时返回 409。
- `POST /api/dictionaries/{id}/restore`：恢复。

```json
{
  "type": "sub_industry",
  "value": "银行",
  "parentId": 10,
  "sortOrder": 20
}
```

方案目录类型依次为 `solution`、`sub_solution`、`product`，后两级创建须传对应上级 `parentId`。产品节点引用可维护目录的稳定编码，不可重命名编码；同一产品可关联不同细分方案。推荐关系不限制项目独立已购产品。

`type` 使用小写字母开头、数字和下划线，最长64字符。内置类型为 `track`、`solution`、`sub_solution`、`product`、`industry`、`sub_industry`；其余为自建字典，均为单层值（`parentId=null`）。项目的 `securityBudget` 是“客户安全预算（万元）”数值字段，不属于字典；`scenario` 是应用场景自由文本，也不属于字典。

### 字典分类

- `GET /api/dictionary-categories`：返回 `{id,type,label,builtIn,sortOrder,createdAt,updatedAt}[]`，包含无值的空字典。
- `POST /api/dictionary-categories`：请求 `{type,label,sortOrder}`，创建自建字典。
- `PUT /api/dictionary-categories/{id}`：同上请求，可改显示名称和排序，`type` 不可改。
- `DELETE /api/dictionary-categories/{id}`：仅可删除没有值、没有自定义字段关联的自建字典；内置分类不可改名或删除。

历史自建类型自动补齐分类，已有字段不自动绑定。界面自动生成稳定编码，分类中文名称可修改；金额和自由文本不因此成为字典。

### 字典值批量导入

`POST /api/dictionaries/import`

```json
{
  "type": "custom_region",
  "parentId": null,
  "dryRun": true,
  "records": [
    { "sourceRow": 2, "value": "华东" },
    { "sourceRow": 3, "value": "华南" }
  ]
}
```

每批1至5000条，`value` 去除首尾空格，最长255字符；相同类型和上级下现有值、批内重复值忽略大小写跳过。`dryRun=true` 不新增分类、字典项或字段；正式导入每行独立处理，失败不阻挡其他有效值。响应 `{dryRun,added,skipped,failed,details:[{sourceRow,value,status,reason,id}]}`，`status` 为 `added/skipped/failed`；预检 `added` 尚无 `id`。内置子行业、细分方案和产品导入须指定正确上级；产品受动态目录约束，赛道 HCS/公有云禁止自行扩充。

界面先选字典（或内置层级的目标上级），支持 Excel/XLS/CSV 首个工作表的指定列，及每行一个值的多行粘贴。空行忽略但保留非空值的原始行号。预检后显示重复和错误明细，确认后仅新增有效值，不覆盖现有项。

## 配置

### 导入映射方案

- `GET/POST /api/config/import-mappings`
- `PUT/DELETE /api/config/import-mappings/{id}`
- `POST /api/config/import-mappings/{id}/restore`

```json
{
  "name": "源平台标准导出",
  "columnMap": {
    "客户名称": "customerName",
    "项目名称": "projectName"
  },
  "valueRules": [
    {"type": "exact", "source": "行业", "mapping": {"金融行业": {"industry": "金融"}}}
  ]
}
```

后端持久化映射配置；三种映射规则的实际转换由前端在本地解析 Excel 时执行。

标准值对照沿用 `exact`，新增可选 `matchField`（匹配转换后的目标字段而非原始列）和 `when`（上级字段条件）。旧的 `source` 规则继续有效。例如：

```json
{"type":"exact","source":"","matchField":"subSolution","when":{"solution":"云安全"},"mapping":{"原细分名称":{"subSolution":"标准细分名称"}}}
```

标准值对照不会新增字典选项；本次批量补客户和逐行修正不作为通用映射规则保存。

### 导出模板

- `GET/POST /api/config/export-templates`
- `PUT/DELETE /api/config/export-templates/{id}`
- `POST /api/config/export-templates/{id}/restore`

```json
{
  "name": "领导总表",
  "scope": "projects",
  "columns": [
    {"key": "customerName", "title": "客户名称"},
    {"key": "revenueTotal", "title": "收入合计（万元）"}
  ]
}
```

### 自定义字段

- `GET/POST /api/config/custom-fields`
- `PUT/DELETE /api/config/custom-fields/{id}`
- `POST /api/config/custom-fields/{id}/restore`

```json
{
  "fieldKey": "stage",
  "label": "项目阶段",
  "fieldType": "option",
  "required": false,
  "options": ["初访", "方案", "POC", "商务"],
  "sortOrder": 10
}
```

`fieldType` 支持 `text/number/date/option`。`fieldKey` 创建后不可改名；被项目数据引用时不可删除。修改类型、必填或选项规则时，后端会先验证全部现有数据。

选项字段可额外传 `"dictionaryType":"custom_region"`、`"options":[]`，关联一个自建字典；非选项字段不能关联，内置分类不可作为自定义字段选项来源。未传或为 `null` 时保持原手填选项行为。响应的 `options` 始终为当前有效选项，字典新增/导入后会实时更新；可选字段允许关联空字典，必填字段不可关联空字典。绑定、切换字典或恢复字段时检查规则与已有项目（含回收站）的值；字典值改名同步关联项目及字段级修改日志，被引用的值禁止删除，生效中的必填字段关联字典不可删到空。已软删除字段的关联仍保护分类，以保留恢复能力。全量备份含分类及字段的 `dictionaryType`。

## 导入

### `POST /api/import`

完整示例见 `scripts/sample-import.json`。

```json
{
  "mappingId": null,
  "dryRun": true,
  "pendingFields": [],
  "records": [
    {
      "sourceRow": 2,
      "fields": {
        "externalId": "CRM-002",
        "customerName": "示例客户",
        "projectName": "云安全运营",
        "industry": "政府",
        "customFields": {}
      },
      "revenues": [
        {"month": "2026-10", "amount": 300.00}
      ],
      "progress": [
        {"logDate": "2026-08-18", "content": "完成资料收集"}
      ]
    }
  ]
}
```

`fields` 同时接受 camelCase 与 snake_case。覆盖项目时，未出现的字段保持原值；出现的空字段会清空。响应状态为 `added`、`overwritten` 或 `skipped`。

前端导入向导会先按字段名称和常用别名匹配基础字段及已有自定义字段。未匹配列会根据非空样本推断为 `text`、`number` 或 `date`，字段名称可在映射时修改。待新增字段通过可选的 `pendingFields: [{fieldKey,label,fieldType}]` 随请求提交；预检只验证、不创建，正式执行时仅创建成功行实际使用的字段，与该行项目写入处于同一事务。旧客户端不传 `pendingFields` 仍可用。

`sourceRow` 是可选的 Excel 原始行号，响应原样返回；`row` 仍是本次请求内从 1 开始的序号。每条详情新增 `issues: [{field,code,message}]` 与 `effectiveFields`（合并已有项目后的字段），原有 `reason` 继续返回。`code` 包括 `required/option/format/length/definition/duplicate/conflict`；同一行的问题尽量一次返回。先按项目标识匹配已有项目，再校验合并结果，未映射客户名称的更新可沿用原客户。

预检页支持批量补客户、逐行修正、按上级上下文进行标准值对照，以及只提交通过校验的行。成功记录自动从列表移除，不参与当前页面后续提交，失败或未处理记录继续保留，可下载清单。可勾选批量删除不想导入的行；删除仅移出本次导入会话，不调用项目删除接口，移除行也不再参与预检、正式提交或待处理清单下载。当前页面可恢复移除行，已有修正会保留。全部记录已导入或移除时，不再提示还有未导入记录。离开或刷新页面会提示剩余进度丢失；不会自动重试结果不明的正式导入。金额、日期、中标必填项与字典关联仍是阻断错误，不会静默删除或自动替换。重复标识只由通过校验（正式模式下成功写入）的记录占用。

无法转换为有效收入或日期的行先显示本地格式问题，不进入服务端批次，避免误占后续有效行的重复标识；修正后再自动参加服务端预检。演示与正式模式均允许未配置子行业字典时保留自由文本，解决方案与产品仍校验父子关联。

产品独立列使用 `product:<产品编码>` 作为映射值，例如 `"WAF列": "product:WAF"`。映射界面显示“已购产品”和具体产品两个选择层级；数据转换时单元格非空即把该产品加入 `purchasedProducts`，空值表示未购。

## 导出

### `GET /api/export/fields?scope=combined`

查询指定范围可用字段。`combined` 返回项目字段、已有收入月份列、收入合计、进展汇总和自定义字段。收入月份字段使用 `revenue.YYYY-MM`，例如 `revenue.2026-08`。

### `POST /api/export`

使用模板：

```json
{
  "templateId": 1,
  "filters": {
    "industry": "金融",
    "startMonth": "2026-01",
    "endMonth": "2026-12"
  }
}
```

临时列配置：

```json
{
  "scope": "combined",
  "columns": [
    {"key": "customerName", "title": "客户名称"},
    {"key": "projectName", "title": "项目名称"},
    {"key": "revenue.2026-08", "title": "2026-08收入（万元）"},
    {"key": "revenueTotal", "title": "收入合计"},
    {"key": "progressSummary", "title": "进展日志"}
  ],
  "filters": {}
}
```

`scope` 支持 `combined/projects/revenues/progress`。前端默认综合宽表每活动项目一行，动态目录以 `product.<编码>` 拆列，已购填“已购”、未购留空；收入按月数值列，`solutions` 为父子关系 JSON，`progressSummary` 倒序换行“日期：内容”，不产生收入×进展笛卡尔积。月份筛选同时约束收入、合计和进展。返回 JSON 与有序列定义，xlsx 由前端 Worker 生成一个工作表。历史 `purchasedProducts` 列会展开为目录产品列。

## 备份与健康

- `GET /api/backup`：下载全量 JSON，包含 `project_products`、软删除数据和修改日志。
- `GET /actuator/health`：容器健康检查，不使用统一业务响应结构。
