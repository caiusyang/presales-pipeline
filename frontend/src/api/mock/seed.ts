import type {
  ChangeLog,
  CustomFieldDef,
  DictNode,
  ExportTemplate,
  ImportMapping,
  ProgressLog,
  Project,
  Revenue,
} from '@/types'
import { PRODUCT_CATALOG } from '@/lib/products'

// ============================================================
// Mock 种子数据：字典 / 自定义字段 / 模板 / 项目及其收入、进展
// ============================================================

export interface MockDB {
  seq: number
  projects: Project[]
  revenues: Revenue[]
  progressLogs: ProgressLog[]
  changeLogs: ChangeLog[]
  dictionaries: DictNode[]
  importMappings: ImportMapping[]
  exportTemplates: ExportTemplate[]
  customFieldDefs: CustomFieldDef[]
}

const INDUSTRIES: [string, string[]][] = [
  ['金融', ['银行', '证券', '保险', '基金']],
  ['政务', ['部委', '省市政府', '事业单位']],
  ['制造', ['汽车', '电子', '装备制造']],
  ['医疗', ['医院', '药企', '器械']],
  ['能源', ['电力', '石油石化', '新能源']],
  ['互联网', ['电商', '游戏', '内容平台']],
  ['教育', ['高校', '职业教育', 'K12']],
  ['交通物流', ['航空', '港口', '快递快运']],
]

const TRACKS = ['信创替代', '云原生', '大数据', '人工智能', '安全', '数字化转型']
const SOLUTIONS = ['分布式数据库', '中间件', '云平台', '数据仓库', 'BI 报表', '零信任安全', '大模型平台', '容灾备份']

const CUSTOMERS: [string, string, string][] = [
  ['华信银行', '金融', '银行'],
  ['东海证券', '金融', '证券'],
  ['康泰保险', '金融', '保险'],
  ['省政务服务局', '政务', '省市政府'],
  ['市大数据中心', '政务', '事业单位'],
  ['宏远汽车', '制造', '汽车'],
  ['精工电子', '制造', '电子'],
  ['仁济医院', '医疗', '医院'],
  ['百草药业', '医疗', '药企'],
  ['国网华东分部', '能源', '电力'],
  ['长风石化', '能源', '石油石化'],
  ['星罗电商', '互联网', '电商'],
  ['幻影游戏', '互联网', '游戏'],
  ['南江大学', '教育', '高校'],
  ['蓝天航空', '交通物流', '航空'],
  ['迅达物流', '交通物流', '快递快运'],
]

const PROJECT_SUFFIX = [
  '核心系统信创改造',
  '数据中台建设',
  '私有云平台扩容',
  '大模型智能客服',
  '零信任安全体系',
  '经营分析 BI 平台',
  '数据仓库升级',
  '中间件国产化替换',
  '容灾双活建设',
  '数字化营销平台',
]

const PROGRESS_TEXTS = [
  '完成售前调研，输出调研报告',
  '与客户召开方案交流会，反馈积极',
  '提交初步方案与报价，等待评审',
  '客户预算已批复，进入招采流程',
  '完成 POC 测试，指标全部达标',
  '投标文件已提交，等待开标',
  '客户内部立项通过',
  '竞争对手报价更低，需调整策略',
  '完成商务谈判，等待合同盖章',
  '项目暂停，客户组织架构调整',
]

// 可复现伪随机
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedDB(): MockDB {
  const rand = mulberry32(20260817)
  let seq = 1
  const now = new Date().toISOString()

  // 字典（子行业为 sub_industry 类型，parentId 指向行业）
  const dictionaries: DictNode[] = []
  TRACKS.forEach((t, i) => dictionaries.push({ id: seq++, type: 'track', value: t, parentId: null, sortOrder: (i + 1) * 10 }))
  let indSort = 0
  for (const [ind, subs] of INDUSTRIES) {
    const pid = seq++
    dictionaries.push({ id: pid, type: 'industry', value: ind, parentId: null, sortOrder: (indSort += 10) })
    subs.forEach((s, i) =>
      dictionaries.push({ id: seq++, type: 'sub_industry', value: s, parentId: pid, sortOrder: (i + 1) * 10 }),
    )
  }
  SOLUTIONS.forEach((s, i) => {
    const solutionId = seq++
    dictionaries.push({ id: solutionId, type: 'solution', value: s, parentId: null, sortOrder: (i + 1) * 10 })
    const subId = seq++
    dictionaries.push({ id: subId, type: 'sub_solution', value: `${s}标准方案`, parentId: solutionId, sortOrder: 10 })
    PRODUCT_CATALOG.forEach((product, productIndex) => {
      dictionaries.push({
        id: seq++,
        type: 'product',
        value: product,
        parentId: subId,
        sortOrder: (productIndex + 1) * 10,
      })
    })
  })

  const customFieldDefs: CustomFieldDef[] = [
    { id: seq++, fieldKey: 'expected_sign_date', label: '预计签约日期', fieldType: 'date', required: false, options: [], sortOrder: 10 },
    { id: seq++, fieldKey: 'budget', label: '预算(万元)', fieldType: 'number', required: false, options: [], sortOrder: 20 },
    {
      id: seq++, fieldKey: 'stage', label: '所处阶段', fieldType: 'option', required: false,
      options: ['线索', '方案交流', 'POC', '招采', '谈判', '已签约', '暂停'], sortOrder: 30,
    },
  ]

  // 项目
  const projects: Project[] = []
  const revenues: Revenue[] = []
  const progressLogs: ProgressLog[] = []
  const changeLogs: ChangeLog[] = []

  const stageOptions = customFieldDefs[2].options
  CUSTOMERS.forEach(([customer, industry, subIndustry], ci) => {
    const n = rand() > 0.6 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const id = seq++
      const suffix = PROJECT_SUFFIX[(ci + k * 3) % PROJECT_SUFFIX.length]
      const track = TRACKS[Math.floor(rand() * TRACKS.length)]
      const solution = SOLUTIONS[Math.floor(rand() * SOLUTIONS.length)]
      const created = `2026-0${1 + Math.floor(rand() * 7)}-1${Math.floor(rand() * 9)}T08:00:00`
      projects.push({
        id,
        externalId: rand() > 0.4 ? `EXT-${1000 + ci * 10 + k}` : null,
        customerName: customer,
        projectName: `${customer}${suffix}${k > 0 ? '（二期）' : ''}`,
        projectStatus: '机会点识别',
        safetySpace: rand() > 0.5 ? '预算内' : '待确认',
        solution,
        subSolution: '',
        purchasedProducts: [],
        track,
        industry,
        subIndustry,
        scenario: `${customer}现有系统面临性能瓶颈，拟通过${solution}实现${track}目标。`,
        keyNeeds: '高可用、平滑迁移、原厂服务能力',
        keyRisks: rand() > 0.5 ? '预算收紧，决策链长' : '竞争激烈，需差异化方案',
        customFields: {
          expected_sign_date: `2026-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-15`,
          budget: Math.round(rand() * 900 + 50),
          stage: stageOptions[Math.floor(rand() * stageOptions.length)],
        },
        revenueTotal: 0,
        deleted: false,
        createdAt: created,
        updatedAt: now,
      })

      const months = [
        '2025-09', '2025-10', '2025-11', '2025-12',
        '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
      ]
      const cnt = 2 + Math.floor(rand() * 7)
      const picked = new Set<number>()
      while (picked.size < cnt) picked.add(Math.floor(rand() * months.length))
      for (const mi of picked) {
        revenues.push({ id: seq++, projectId: id, month: months[mi], amount: Math.round((rand() * 190 + 10) * 100) / 100 })
      }
      const pc = 1 + Math.floor(rand() * 4)
      for (let i = 0; i < pc; i++) {
        const d = `2026-0${Math.max(1, 8 - i)}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`
        progressLogs.push({
          id: seq++,
          projectId: id,
          logDate: d,
          content: PROGRESS_TEXTS[Math.floor(rand() * PROGRESS_TEXTS.length)],
          createdAt: `${d}T09:00:00`,
        })
      }
    }
  })

  const p0 = projects[0]
  changeLogs.push({
    id: seq++, projectId: p0.id, operator: '我', field: 'track',
    oldValue: '大数据', newValue: p0.track, source: 'manual', createdAt: '2026-08-10T02:30:00',
  })
  changeLogs.push({
    id: seq++, projectId: p0.id, operator: '我', field: 'keyRisks',
    oldValue: '', newValue: p0.keyRisks, source: 'import', createdAt: '2026-08-12T06:00:00',
  })

  const importMappings: ImportMapping[] = [
    {
      id: seq++,
      name: '领导总表标准映射',
      columnMap: {
        编号: 'externalId',
        客户: 'customerName',
        项目: 'projectName',
        行业: 'industry',
        赛道: 'track',
        方案: 'solution',
        进展: 'progressText',
      },
      valueRules: [
        { type: 'split', source: '行业', delimiter: '-', targets: ['industry', 'subIndustry'] },
        { type: 'default', field: 'safetySpace', value: '待确认' },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]

  const exportTemplates: ExportTemplate[] = [
    {
      id: seq++, name: '领导总表（主表）', scope: 'projects',
      columns: [
        { key: 'customerName', title: '客户名称' },
        { key: 'projectName', title: '项目名称' },
        { key: 'industry', title: '行业' },
        { key: 'subIndustry', title: '子行业' },
        { key: 'track', title: '赛道' },
        { key: 'solution', title: '解决方案' },
        { key: 'revenueTotal', title: '累计收入(万元)' },
        { key: 'keyRisks', title: '关键风险' },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: seq++, name: '收入明细', scope: 'revenues',
      columns: [
        { key: 'customerName', title: '客户名称' },
        { key: 'projectName', title: '项目名称' },
        { key: 'month', title: '月份' },
        { key: 'amount', title: '金额(万元)' },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: seq++, name: '进展日志', scope: 'progress',
      columns: [
        { key: 'customerName', title: '客户名称' },
        { key: 'projectName', title: '项目名称' },
        { key: 'logDate', title: '日期' },
        { key: 'content', title: '进展内容' },
      ],
      createdAt: now, updatedAt: now,
    },
  ]

  return {
    seq,
    projects,
    revenues,
    progressLogs,
    changeLogs,
    dictionaries,
    importMappings,
    exportTemplates,
    customFieldDefs,
  }
}
