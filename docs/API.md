# API 联调契约

基础地址：`/api`。所有响应均为 `{code, message, data}`。除获取 CSRF 令牌和登录外，业务接口均要求已登录的服务端会话；所有 POST、PUT、PATCH、DELETE 请求需要提交 CSRF 请求头。

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
| `industry` / `track` / `keyword` | 行业、赛道、关键字筛选 |
| `startMonth` / `endMonth` | `YYYY-MM`；筛选期间有收入的项目，并按该期间计算 `revenueTotal` |
| `page` / `size` | 从 0 开始；每页 1～200 条 |
| `sortBy` | `id/customerName/projectName/industry/track/createdAt/updatedAt` |
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
  "safetySpace": "数据域",
  "solution": "安全咨询",
  "track": "数据安全",
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

### `GET /api/projects/{id}/detail`

一次返回 `project`、`progress`、`revenues`、`changeLogs`。

### `DELETE /api/projects/{id}`

软删除项目。

### `POST /api/projects/{id}/restore`

恢复项目；若已存在同客户同名活动项目则返回 409。

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

- `GET /api/dictionaries?type=industry`：树查询；行业节点会带子行业 `children`。
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

`type` 使用小写字母、数字和下划线。内置业务类型包括 `track`、`solution`、`industry`、`sub_industry`，也可配置 `safety_space`。

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

## 导入

### `POST /api/import`

完整示例见 `scripts/sample-import.json`。

```json
{
  "mappingId": null,
  "dryRun": true,
  "records": [
    {
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

## 导出

### `GET /api/export/fields?scope=projects`

查询指定范围可用字段。`projects` 还会返回 `custom.{fieldKey}` 自定义字段。

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
  "scope": "projects",
  "columns": [
    {"key": "customerName", "title": "客户名称"},
    {"key": "revenueTotal", "title": "收入合计"}
  ],
  "filters": {}
}
```

`scope` 支持 `projects/revenues/progress`。响应只返回 JSON 和有序列定义，xlsx 由前端生成。

## 备份与健康

- `GET /api/backup`：下载全量 JSON，包含软删除数据和修改日志。
- `GET /actuator/health`：容器健康检查，不使用统一业务响应结构。
