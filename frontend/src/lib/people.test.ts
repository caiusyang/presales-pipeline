import { describe, expect, it } from 'vitest'
import { matchPeople, type Person } from './people'
const people: Person[] = [{ id: 1, name: '同名', employeeNo: '1', account: null, aliases: ['甲'], enabled: true }, { id: 2, name: '同名', employeeNo: '2', account: 'b', aliases: ['乙'], enabled: true }, { id: 3, name: '停用', employeeNo: '3', account: null, aliases: [], enabled: false }]
describe('责任人精确匹配', () => {
  it('保存所有唯一命中人员，报告同名和未匹配，不做模糊绑定', () => { const result = matchPeople(people, [{ name: '同名' }, { name: '甲' }, { employeeNo: '2' }, { name: '甲' }, { name: '同' }, { employeeNo: '3' }]); expect(result.personIds).toEqual([1, 2]); expect(result.issues).toHaveLength(3) })
  it('有唯一标识但未命中时不按姓名降级，冲突标识不自动绑定', () => { expect(matchPeople(people, [{ name: '甲', employeeNo: 'unknown' }, { employeeNo: '1', account: 'b' }]).personIds).toEqual([]) })
})
