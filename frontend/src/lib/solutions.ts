import type { SolutionSelection } from '@/types'
export function solutionSelections(value: { solutions?: SolutionSelection[]; solution?: string; subSolution?: string }): SolutionSelection[] {
  return value.solutions ?? (value.solution ? [{ solution: value.solution, subSolutions: value.subSolution ? [value.subSolution] : [] }] : [])
}
export function normalizeSolutions(entries: SolutionSelection[]): SolutionSelection[] {
  const grouped = new Map<string, Set<string>>()
  for (const entry of entries) {
    const key = entry.solution.trim(), children = grouped.get(key) ?? new Set<string>()
    entry.subSolutions.forEach((s) => { if (s.trim()) children.add(s.trim()) }); grouped.set(key, children)
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([solution, children]) => ({ solution, subSolutions: [...children].sort() }))
}
export function withSolutions<T extends { solution?: string; subSolution?: string }>(value: T, solutions: SolutionSelection[]) {
  return { ...value, solutions, solution: solutions[0]?.solution ?? '', subSolution: solutions[0]?.subSolutions[0] ?? '' }
}
export const solutionText = (entries: SolutionSelection[]) => entries.map((s) => `${s.solution}${s.subSolutions.length ? ` / ${s.subSolutions.join('、')}` : ''}`).join('；')
