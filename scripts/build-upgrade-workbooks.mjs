import fs from 'node:fs/promises'
import path from 'node:path'
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool'

const output = path.resolve(process.env.PRESALES_ARTIFACT_OUTPUT || 'docs/deliverables')
await fs.mkdir(output, { recursive: true })
const mappingRows = [
  ['客户名称', 'customerName', '客户主体名称', '文本', '—', '公共', '去首尾空白；缺失时由用户补齐', '与现有客户名含义一致'],
  ['行业', 'industry', '客户行业', '字典', '—', '公共', '现有行业字典校验，不自动扩充', '与公共行业字段一致'],
  ['业务场景', 'scenario', '项目业务或技术使用背景', '长文本', '—', '公共', '保留原文及换行', '与应用场景含义一致'],
  ['安全关键需求', 'keyNeeds', '安全关键需求', '长文本', '—', '公共', '保留原文', '与关键需求含义一致'],
  ['当前进展', 'progress[]', '多条业务进展；日期不是录入时间', '日期＋长文本', '日', '公共', '严格日期；缺年需明确选择默认年份；续行保留；无日期待修正', '拆分到进展记录，不能覆盖成一段文本'],
  ['安全解决方案类型', 'solutions[] / 旧 solution', '结构化解决方案及细分方案父子关系', '关联集合', '—', '公共', '旧单方案转一项；新模板用 JSON 数组；字典校验', '业务含义相同，保留父子关系'],
  ['项目风险和求助', 'keyRisks', '项目风险及所需支持', '长文本', '—', '公共', '风险和求助均完整保留，不截断求助内容', '字段扩展含义，原文完整保留'],
  ['区域', 'custom.region', '来源区域', '文本', '—', '公共', '确认正式导入时创建；可改字段名称', '无等价公共字段，独立保留'],
  ['代表处', 'custom.office', '来源代表处', '文本', '—', '公共', '确认正式导入时创建', '组织口径独立'],
  ['是否云重点客户', 'custom.key_cloud_customer', '云重点客户标记', '文本', '—', '公有云', '保留来源值，可另行配置自定义字典', '不据此推断收入或项目状态'],
  ['项目属性', 'custom.project_attribute', '来源项目属性', '文本', '—', '公共', '独立字段', '含义尚未证明与本地状态一致'],
  ['是否标杆', 'custom.benchmark_customer', '标杆客户或项目标记', '文本', '—', '公共', '独立字段', '不并入客户名称或状态'],
  ['云空间(万/月)', 'custom.cloud_space_monthly', '云业务月度空间，具体口径沿用来源', '数值', '万元/月', '公有云', '独立数值，不汇入收入', '与安全预算的范围、时间周期不同'],
  ['26年新增安全机会', 'custom.security_opportunity_2026', '2026 年新增安全机会原文', '文本', '2026 年', '公有云', '保留来源，未证明是金额或项目数量', '不按名称猜测类型口径'],
  ['26年新增安全空间(万/月)', 'custom.security_space_monthly_2026', '2026 年新增安全月度空间', '数值', '万元/月；2026 年', '公有云', '独立数值，不与云空间／预算／收入合并', '对象及统计周期不同'],
  ['安全空间（其他来源）', '独立扩展字段；待明确口径', '必须先明确单位及周期', '待确认', '待确认', '待确认', '不能自动等同客户安全预算', '仅名称相近不足以合并'],
  ['客户安全预算（万元）', 'securityBudget', '本项目对应客户安全预算', '金额', '万元；单项目', '公共', '可空，允许0，非负，最多两位小数；不计入收入', '沿用已确认的项目预算口径'],
  ['实际收入／按月收入列', 'revenues[]', '已发生的月度实际收入', '金额＋月份', '万元；月', '公共', '明确月份，独立记录；总额由数据库汇总', '不能与预算或空间相加'],
  ['预计下单时间', 'custom.expected_order_date', '预计发生下单的日期', '日期', '日', '公共', '需有效完整日期；不能转为下次行动日期', '业务事件不同'],
  ['下次行动日期', 'nextActionDate', '本平台下一次需要行动的日期', '日期', '日；上海时区', '公共', '可清空；保留逾期标记直到用户完成或改期', '不是预计下单时间'],
  ['一线SA', 'custom.frontline_sa', '来源岗位和人员原文', '文本', '—', '公共', '先保留岗位来源；按责任人库工号／账号精确匹配，歧义人工处理', '不把多人缩减为一个人'],
  ['需求洞察内 ESA / DDoS / WAF / CFW / HSS / NDR 等', 'custom.<需求字段>', '客户需求或洞察，不代表已购', '按内容推断', '来源口径', '公共', '保留“需求洞察”路径；不能映射为已购列', '产品同名但业务含义不同'],
  ['已购产品/WAF 等独立列', 'purchasedProducts[] ＋ project_products', '实际产品拥有情况', '目录关联集合', '非空即已购', '依目录', '仅明确已购含义时使用非空规则；产品编码稳定', '独立于方案推荐产品'],
  ['备注', 'custom.source_note', '来源补充说明', '长文本', '—', '公共', '保留完整原文', '无等价字段，不丢弃'],
  ['旧赛道：数据安全／云安全／网络安全等', 'securityDirection', '原来的安全方向', '字典', '—', '公共', '迁入安全方向，业务赛道置待分类；输出迁移异常', '无证据判断 HCS 或公有云'],
  ['赛道', 'track', 'HCS 或公有云业务赛道', '固定选项', '—', '公共', '只接受 HCS、公有云；不根据安全方向猜测', '与安全方向分离'],
  ['HCS 真实源字段', '待 API 资料确认', '真实协议尚未提供', '待确认', '待确认', 'HCS', '不上线虚构映射；当前仅提供本地公共字段模板', '真实 HCS 对照表和联调作为后续上线条件'],
  ['HCS机会点编号', 'hcsOpportunityId', '显式绑定的 HCS 编号', '文本', '—', 'HCS', '独立于通用外部编号；不批量猜测转换', '编号体系及来源独立'],
  ['本地售前状态 / HCS状态', 'projectStatus / hcsStatus', '本地跟进与外部业务状态', '两套独立状态', '—', '公共 / HCS', 'HCS 状态只读，不能触发本地中标校验', '两套状态不能合并'],
]
const headers = ['来源字段', '标准字段', '含义', '类型', '单位／时间范围', '适用赛道', '转换规则', '合并或保留理由']

let tableIndex = 0
function sheet(wb, name, matrix, widths) {
  const s = wb.worksheets.add(name)
  const last = column(matrix[0].length - 1)
  s.showGridLines = false; s.tabColor = '#176A78'
  s.getRange(`A1:${last}${matrix.length}`).values = matrix
  s.getRange(`A1:${last}${matrix.length}`).format = { font: { name: 'Microsoft YaHei', size: 10, color: '#20333B' }, wrapText: true, verticalAlignment: 'center', rowHeight: 52 }
  s.getRange(`A1:${last}1`).format = { fill: '#163B4B', font: { name: 'Microsoft YaHei', size: 11, color: '#FFFFFF', bold: true }, rowHeight: 40, wrapText: true }
  widths.forEach((width, i) => { s.getRange(`${column(i)}:${column(i)}`).format.columnWidth = width })
  for (let row = 2; row <= matrix.length; row++) if (row % 2 === 0) s.getRange(`A${row}:${last}${row}`).format.fill = '#F0F7F8'
  s.freezePanes.freezeRows(1); s.freezePanes.freezeColumns(1)
  s.tables.add(`A1:${last}${matrix.length}`, true, `TUpgrade${++tableIndex}`)
  return s
}
function column(i) { let v = i + 1, s = ''; while (v) { s = String.fromCharCode(65 + (v - 1) % 26) + s; v = Math.floor((v - 1) / 26) } return s }
async function finish(wb, filename, renders) {
  await wb.recalculate()
  console.log((await wb.inspect({ kind: 'sheet', include: 'id,name', maxChars: 1500 })).ndjson)
  for (const [sheetName, range] of renders) {
    const preview = await wb.render({ sheetName, range, scale: 1.3, format: 'png' })
    await fs.writeFile(path.join(output, `${filename}-${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()))
    const inspected = await wb.inspect({ kind: 'region', sheetId: sheetName, range, maxChars: 1500, tableMaxRows: 3 })
    console.log(inspected.ndjson)
  }
  const file = await SpreadsheetFile.exportXlsx(wb); const target=path.join(output, `${filename}.xlsx`); await file.save(target)
  await verifyWorkbook(target)
}
async function verifyWorkbook(target) {
  const imported = await SpreadsheetFile.importXlsx(await FileBlob.load(target))
  for (const s of imported.worksheets.items) {
    const values = s.getUsedRange().values
    for (const row of values) for (const cell of row) if (typeof cell === 'string' && /^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|SPILL!)/.test(cell)) throw new Error(`${target} 有单元格错误：${cell}`)
  }
  if (!target.endsWith('统一字段对照表.xlsx')) {
    const s=imported.worksheets.getItem('项目导入')
    if (s.getRange('E2').values[0][0] !== 0 || !Array.isArray(JSON.parse(s.getRange('F2').values[0][0]))) throw new Error('预算数值或方案 JSON 往返校验失败')
  }
  console.log(`ROUNDTRIP_OK ${path.basename(target)}`)
}

if(process.argv.includes('--verify-only')) {for(const name of ['统一字段对照表','公有云导入模板','HCS本地项目模板'])await verifyWorkbook(path.join(output,`${name}.xlsx`));process.exit(0)}
const wb = Workbook.create()
sheet(wb, '字段对照', [headers, ...mappingRows], [30, 38, 40, 20, 25, 16, 68, 55])
sheet(wb, '口径与来源', [['项目', '内容'], ['业务口径', 'HCS／公有云是业务赛道；安全方向独立；客户安全预算为项目级万元，不参与收入统计。'], ['日期', '进展日期与录入时间分开。缺年由用户明确选择默认年份；无日期、非法日期不使用当天兜底。'], ['方案统计', '同一方案内项目去重；一级方案不能累加细分方案数。跨方案各自计入，全局仍按项目去重；不分摊收入。'], ['HCS状态', '真实接口资料按用户决定暂留；当前不提供虚构同步或定时调用。'], ['来源', '云安全解决方案需求洞察_表头.xlsx / 安全项目需求洞察!A2:AD5；用户提供的改造指导书。'], ['注意', '来源表无项目名称列，须在预检补齐项目名称，不自动用客户名猜测。产品目录中的别名只帮助识别，不表示已经购买。']], [24, 115])
await finish(wb, '统一字段对照表', [['字段对照', 'A1:D8'], ['口径与来源', 'A1:B7']])

const common = ['客户名称', '项目名称', '本地售前状态', '赛道', '客户安全预算（万元）', '方案集合（JSON）', '已购产品/WAF', '下次行动日期', '下次行动内容', '当前进展', '业务场景', '安全关键需求', '项目风险和求助']
for (const track of ['公有云', 'HCS']) {
  const book = Workbook.create(), name = track === 'HCS' ? 'HCS本地项目模板' : '公有云导入模板'
  const columns = track === 'HCS' ? [...common, 'HCS机会点编号'] : [...common, '云空间(万/月)', '26年新增安全空间(万/月)', '需求洞察/WAF']
  const values = ['示例客户（请替换）', '示例项目（请替换）', '机会点识别', track, 0, '[]', '', '2026-11-01', '请填写下一次实际行动', '2025-09-13：示例进展，请替换\n后续无日期行并入同一条进展', '', '', '']
  const row = track === 'HCS' ? [...values, ''] : [...values, null, null, '需求说明（不是已购）']
  const data = sheet(book, '项目导入', [columns, row], columns.map((_, i) => i === 5 || i === 9 ? 58 : i > 8 ? 35 : 24))
  data.getRange('E2:E1001').setNumberFormat('0.00')
  data.getRange('C2:C1001').dataValidation = { rule: { type: 'list', values: ['机会点识别', '方案引导', '方案设计', '中标'] } }
  sheet(book, '使用说明', [['事项', '说明'], ['导入方式', '只导入第一个工作表；删除示例行或替换为真实数据。映射和预检不会创建自定义字段。'], ['方案集合', '[{"solution":"现有一级方案","subSolutions":["其下的细分方案"]}]；以实际字典值替换，允许多组。[] 表示明确清空方案。'], ['已购产品', '明确标注“已购产品/产品名”的列，非空即已购。可从配置页新增产品，再添加对应列；需求洞察列不会转为已购。'], ['赛道', 'HCS、公有云独立模板；跨赛道导出是字段并集。'], ['HCS 限制', 'HCS 模板只含本平台公共字段及显式绑定编号，不代表取得真实 HCS 源字段或已完成联调。'], ['日期', '进展首行需有效日期；缺少年份时需在导入页面设置默认年份。不允许无日期首段或不存在的日期。'], ['自定义字段', '未匹配列会建议新增，名称和类型可调整；确认正式导入时才创建。']], [24, 115])
  await finish(book, name, [['项目导入', 'A1:F2'], ['使用说明', 'A1:B8']])
}
