import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RevenueEntryMode } from '@/components/revenue/RevenueEntryMode'
import { RevenueStatsMode } from '@/components/revenue/RevenueStatsMode'

export default function RevenuePage() {
  const [tab, setTab] = useState('entry')
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">收入统计</h1>
        <p className="text-sm text-muted-foreground">
          按月录入各项目收入（万元），并按项目 / 行业 / 月度 / 年度维度统计
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="entry">录入模式</TabsTrigger>
          <TabsTrigger value="stats">统计模式</TabsTrigger>
        </TabsList>
        <TabsContent value="entry">
          <RevenueEntryMode />
        </TabsContent>
        <TabsContent value="stats">
          <RevenueStatsMode />
        </TabsContent>
      </Tabs>
    </div>
  )
}
