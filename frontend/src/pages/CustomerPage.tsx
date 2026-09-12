import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { ChevronRight, FolderKanban, PackageCheck, Search, Trophy, Users, WalletCards } from 'lucide-react'
import { ProjectDetailDrawer } from '@/components/project/ProjectDetailDrawer'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCustomers } from '@/hooks/queries'
import { fmtAmount } from '@/lib/format'
import { PROJECT_STATUSES, type ID } from '@/types'
import type { CustomerAnalysis } from '@/api/types'

const STATUS_VARIANTS = {
  机会点识别: 'secondary',
  方案引导: 'info',
  方案设计: 'warning',
  中标: 'success',
} as const

function ProductBadges({ products, limit }: { products: string[]; limit?: number }) {
  const visible = limit == null ? products : products.slice(0, limit)
  if (products.length === 0) return <span className="text-xs text-muted-foreground">暂无已购产品</span>
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((product) => <Badge key={product} variant="outline">{product}</Badge>)}
      {limit != null && products.length > limit && (
        <Badge variant="secondary">+{products.length - limit}</Badge>
      )}
    </div>
  )
}

export default function CustomerPage() {
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalysis | null>(null)
  const [projectId, setProjectId] = useState<ID | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const customersQ = useCustomers(debouncedKeyword)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const customers = customersQ.data ?? []
  const totals = useMemo(() => ({
    projects: customers.reduce((sum, customer) => sum + customer.projectCount, 0),
    won: customers.reduce((sum, customer) => sum + customer.wonProjectCount, 0),
    revenue: customers.reduce((sum, customer) => sum + customer.revenueTotal, 0),
    products: new Set(customers.flatMap((customer) => customer.purchasedProducts)).size,
  }), [customers])

  const openProject = (id: ID) => {
    setSelectedCustomer(null)
    setProjectId(id)
    setProjectOpen(true)
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">客户分析</h1>
        <p className="text-sm text-muted-foreground">从客户维度汇总关联项目、项目状态、累计收入和已购产品</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={Users} label="客户数" value={String(customers.length)} />
        <SummaryCard icon={FolderKanban} label="关联项目" value={String(totals.projects)} />
        <SummaryCard icon={Trophy} label="中标项目" value={String(totals.won)} />
        <SummaryCard icon={PackageCheck} label="已购产品种类" value={String(totals.products)} />
        <SummaryCard icon={WalletCards} label="累计收入（万元）" value={fmtAmount(totals.revenue)} />
      </div>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索客户、项目、外部编号或产品"
          className="pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        {customersQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title={debouncedKeyword ? '没有匹配的客户' : '暂无客户数据'}
            description={debouncedKeyword ? '请尝试其他客户、项目或产品关键词' : '创建或导入项目后将在这里自动汇总'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>客户名称</TableHead>
                <TableHead>关联项目</TableHead>
                <TableHead>项目状态</TableHead>
                <TableHead className="min-w-64">已购产品</TableHead>
                <TableHead className="text-right">累计收入（万元）</TableHead>
                <TableHead>最近更新</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.customerName} className="cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                  <TableCell className="font-medium">{customer.customerName}</TableCell>
                  <TableCell>{customer.projectCount} 个</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {PROJECT_STATUSES.map((status) => {
                        const count = customer.statusCounts[status] ?? 0
                        return count > 0
                          ? <Badge key={status} variant={STATUS_VARIANTS[status]}>{status} {count}</Badge>
                          : null
                      })}
                    </div>
                  </TableCell>
                  <TableCell><ProductBadges products={customer.purchasedProducts} limit={5} /></TableCell>
                  <TableCell className="text-right font-medium">{fmtAmount(customer.revenueTotal)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dayjs(customer.updatedAt).format('YYYY-MM-DD')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="xs">查看项目 <ChevronRight /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Drawer open={selectedCustomer != null} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selectedCustomer?.customerName ?? '客户详情'}</DrawerTitle>
            <DrawerDescription>客户关联项目与已购产品汇总</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {selectedCustomer && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="关联项目" value={`${selectedCustomer.projectCount} 个`} />
                  <Metric label="中标项目" value={`${selectedCustomer.wonProjectCount} 个`} />
                  <Metric label="累计收入" value={`${fmtAmount(selectedCustomer.revenueTotal)} 万元`} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">已购产品</div>
                  <ProductBadges products={selectedCustomer.purchasedProducts} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">关联项目</div>
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/60">
                          <TableHead>项目</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>解决方案</TableHead>
                          <TableHead>已购产品</TableHead>
                          <TableHead className="text-right">累计收入</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCustomer.projects.map((project) => (
                          <TableRow key={project.id}>
                            <TableCell>
                              <Button variant="link" className="h-auto justify-start p-0" onClick={() => openProject(project.id)}>
                                {project.projectName}
                              </Button>
                              {project.externalId && <div className="text-xs text-muted-foreground">{project.externalId}</div>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANTS[project.projectStatus as keyof typeof STATUS_VARIANTS] ?? 'secondary'}>
                                {project.projectStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {[project.solution, project.subSolution].filter(Boolean).join(' / ') || '—'}
                            </TableCell>
                            <TableCell><ProductBadges products={project.purchasedProducts} limit={3} /></TableCell>
                            <TableCell className="text-right">{fmtAmount(project.revenueTotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ProjectDetailDrawer projectId={projectId} open={projectOpen} onOpenChange={setProjectOpen} />
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4 sm:pt-5">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  )
}
