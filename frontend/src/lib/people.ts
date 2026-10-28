export interface Person { id: number; name: string; employeeNo: string | null; account: string | null; aliases: string[]; enabled: boolean }
export type PersonInput = Omit<Person, 'id'>
export interface PersonReference { name?: string; employeeNo?: string; account?: string; role?: string }
export function matchPeople(people: Person[], references: PersonReference[]) {
  const hits = new Set<number>(), issues: string[] = []
  const clean = (value?: string | null) => value?.trim() ?? ''
  for (const ref of references) {
    const matches = people.filter((p) => p.enabled && (clean(ref.employeeNo) || clean(ref.account)
      ? Boolean(clean(ref.employeeNo) && clean(ref.employeeNo).toLowerCase() === clean(p.employeeNo).toLowerCase() || clean(ref.account) && clean(ref.account).toLowerCase() === clean(p.account).toLowerCase())
      : Boolean(clean(ref.name) && (p.name === clean(ref.name) || p.aliases.includes(clean(ref.name))))))
    if (matches.length === 1) hits.add(matches[0].id)
    else issues.push(`${matches.length ? '同名或标识歧义' : '未命中'}：${ref.name ?? ref.employeeNo ?? ref.account ?? '空人员'}`)
  }
  return { personIds: [...hits], issues }
}
