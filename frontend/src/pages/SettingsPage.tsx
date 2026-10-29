import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DictManager } from '@/components/settings/DictManager'
import { MappingManager } from '@/components/settings/MappingManager'
import { TemplateManager } from '@/components/settings/TemplateManager'
import { CustomFieldManager } from '@/components/settings/CustomFieldManager'
import { BackupPanel } from '@/components/settings/BackupPanel'
import { ProgressRepairManager } from '@/components/settings/ProgressRepairManager'
import { ProductCatalogManager } from '@/components/settings/ProductCatalogManager'
import { MigrationIssues } from '@/components/settings/MigrationIssues'
import { PeopleManager } from '@/components/settings/PeopleManager'
import { FollowUpPolicyManager } from '@/components/settings/FollowUpPolicyManager'
import { useSearchParams } from 'react-router-dom'

export default function SettingsPage() {
  const [params] = useSearchParams()
  return (
    <div className="page-shell page-shell-form">
      <header className="page-heading">
        <h1 className="text-lg font-semibold">配置</h1>
        <p className="text-sm text-muted-foreground">
          字典、导入映射、导出模板、自定义字段与数据备份，全部界面自助维护，无需改代码。
        </p>
      </header>
      <Tabs defaultValue={params.get('tab') === 'follow-up' ? 'follow-up' : 'dict'}>
        <TabsList aria-label="配置分类" className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="dict">字典管理</TabsTrigger>
          <TabsTrigger value="follow-up">跟进提醒</TabsTrigger>
          <TabsTrigger value="mapping">导入映射</TabsTrigger>
          <TabsTrigger value="template">导出模板</TabsTrigger>
          <TabsTrigger value="fields">自定义字段</TabsTrigger>
          <TabsTrigger value="backup">数据备份</TabsTrigger>
          <TabsTrigger value="progress-repair">进展日期修复</TabsTrigger>
          <TabsTrigger value="products">产品目录</TabsTrigger>
          <TabsTrigger value="migration">迁移待处理</TabsTrigger>
          <TabsTrigger value="people">责任人库</TabsTrigger>
          <TabsTrigger value="hcs">HCS 接入</TabsTrigger>
        </TabsList>
        <TabsContent value="dict">
          <DictManager />
        </TabsContent>
        <TabsContent value="follow-up"><FollowUpPolicyManager /></TabsContent>
        <TabsContent value="mapping">
          <MappingManager />
        </TabsContent>
        <TabsContent value="template">
          <TemplateManager />
        </TabsContent>
        <TabsContent value="fields">
          <CustomFieldManager />
        </TabsContent>
        <TabsContent value="backup">
          <BackupPanel />
        </TabsContent>
        <TabsContent value="progress-repair"><ProgressRepairManager /></TabsContent>
        <TabsContent value="products"><ProductCatalogManager /></TabsContent>
        <TabsContent value="migration"><MigrationIssues /></TabsContent>
        <TabsContent value="people"><PeopleManager /></TabsContent>
        <TabsContent value="hcs"><p className="rounded border p-4 text-sm">真实 HCS 接口按你的决定暂时遗留，定时同步未开启，也不会按名称自动创建或覆盖项目。机会点绑定、独立状态字段和责任人来源已预留；需补充 API、鉴权、字段／状态、分页和限流资料后才能进行真实联调。</p></TabsContent>
      </Tabs>
    </div>
  )
}
