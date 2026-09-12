import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { normalizeForSubmit, projectToInput } from '@/components/project/project-utils'
import { useCustomFieldDefs, useDictionaries, useProjectMutations } from '@/hooks/queries'
import { solutionCascade } from '@/lib/fields'
import type { Project } from '@/types'

interface Props {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WinProjectDialog({ project, open, onOpenChange }: Props) {
  const [solution, setSolution] = useState('')
  const [subSolution, setSubSolution] = useState('')
  const [products, setProducts] = useState<string[]>([])
  const solutionQ = useDictionaries('solution')
  const customDefsQ = useCustomFieldDefs()
  const { update } = useProjectMutations()
  const cascade = useMemo(() => solutionCascade(solutionQ.data ?? []), [solutionQ.data])
  const subs = solution ? cascade.subMap.get(solution) ?? [] : []
  const productOptions = solution && subSolution
    ? cascade.productMap.get(`${solution}\u0000${subSolution}`) ?? []
    : []

  useEffect(() => {
    if (!open || !project) return
    setSolution(project.solution ?? '')
    setSubSolution(project.subSolution ?? '')
    setProducts([...(project.purchasedProducts ?? [])])
  }, [open, project])

  const chooseSolution = (next: string) => {
    setSolution(next)
    setSubSolution('')
    setProducts([])
  }

  const chooseSubSolution = (next: string) => {
    setSubSolution(next)
    setProducts([])
  }

  const toggleProduct = (product: string, checked: boolean) => {
    setProducts((current) => checked
      ? [...new Set([...current, product])]
      : current.filter((item) => item !== product))
  }

  const submit = () => {
    if (!project) return
    if (!solution) return toast.error('请选择解决方案')
    if (!subSolution) return toast.error('请选择细分解决方案')
    if (products.length === 0) return toast.error('请至少选择一个已购产品')
    const input = {
      ...projectToInput(project),
      projectStatus: '中标' as const,
      solution,
      subSolution,
      purchasedProducts: products,
    }
    update.mutate(
      { id: project.id, input: normalizeForSubmit(input, customDefsQ.data ?? []) },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />确认项目中标</DialogTitle>
          <DialogDescription>
            {project ? `${project.customerName} · ${project.projectName}` : ''}。请选择关联的方案和已购产品，确认后项目状态将更新为“中标”。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>解决方案 <span className="text-destructive">*</span></Label>
            <Select
              value={solution}
              onValueChange={chooseSolution}
              options={cascade.solutions.map((item) => ({ value: item.value, label: item.value }))}
              placeholder="请选择解决方案"
            />
          </div>
          <div className="space-y-1.5">
            <Label>细分解决方案 <span className="text-destructive">*</span></Label>
            <Select
              value={subSolution}
              onValueChange={chooseSubSolution}
              options={subs.map((item) => ({ value: item.value, label: item.value }))}
              placeholder={solution ? '请选择细分解决方案' : '请先选择解决方案'}
              disabled={!solution}
            />
          </div>
          <div className="space-y-1.5">
            <Label>已购产品（可多选） <span className="text-destructive">*</span></Label>
            {productOptions.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {subSolution ? '该细分解决方案尚未配置产品，请先到配置页添加。' : '请先选择细分解决方案。'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                {productOptions.map((product) => (
                  <label key={product.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={products.includes(product.value)}
                      onCheckedChange={(checked) => toggleProduct(product.value, checked === true)}
                    />
                    {product.value}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} disabled={update.isPending || productOptions.length === 0}>
            {update.isPending ? '提交中…' : '确认中标'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
