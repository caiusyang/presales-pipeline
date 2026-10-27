import { describe, expect, it, vi } from 'vitest'
import { emptyProjectInput } from './project-utils'
import type { CustomFieldDef } from '@/types'

vi.mock('@/hooks/queries', () => ({}))

import { invalidProjectOptionValues, reconcileProjectOverviewDraft, sameProjectInput } from './ProjectDetailDrawer'

describe('项目详情中的字典刷新', () => {
  const baseline = { ...emptyProjectInput(), customerName: '客户', projectName: '项目', customFields: { level: '普通客户' } }
  const latest = { ...baseline, customFields: { level: '标准客户' } }

  it('没有未保存修改时显示字典改名后的最新值', () => {
    expect(reconcileProjectOverviewDraft({ baseline, value: { ...baseline } }, latest)).toEqual({ baseline: latest, value: latest })
  })

  it('有未保存修改时保留草稿与旧基线，能够识别服务端更新', () => {
    const draft = { baseline, value: { ...baseline, keyNeeds: '用户刚填写的需求' } }
    const result = reconcileProjectOverviewDraft(draft, latest)
    expect(result).toBe(draft)
    expect(result.value.customFields.level).toBe('普通客户')
    expect(result.value.keyNeeds).toBe('用户刚填写的需求')
    expect(sameProjectInput(result.baseline, latest)).toBe(false)
  })

  it('自定义字段对象键顺序变化不会误判未保存修改', () => {
    expect(sameProjectInput({ ...baseline, customFields: { level: '普通客户', region: '华东' } },
      { ...baseline, customFields: { region: '华东', level: '普通客户' } })).toBe(true)
  })

  it('字典改名后的失效草稿明确保留旧值，重选后才允许保存', () => {
    const definitions: CustomFieldDef[] = [{
      id: 7, fieldKey: 'level', label: '客户级别', fieldType: 'option', required: false,
      options: ['标准客户'], dictionaryType: 'custom_level', sortOrder: 10,
    }]
    expect(invalidProjectOptionValues(baseline, definitions)).toEqual([{ label: '客户级别', value: '普通客户' }])
    expect(invalidProjectOptionValues(latest, definitions)).toEqual([])
    expect(invalidProjectOptionValues({ ...baseline, customFields: { level: '' } }, definitions)).toEqual([])
  })
})
