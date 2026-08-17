import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DictManager } from '@/components/settings/DictManager'
import { MappingManager } from '@/components/settings/MappingManager'
import { TemplateManager } from '@/components/settings/TemplateManager'
import { CustomFieldManager } from '@/components/settings/CustomFieldManager'
import { BackupPanel } from '@/components/settings/BackupPanel'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">配置</h1>
        <p className="text-sm text-muted-foreground">
          字典、导入映射、导出模板、自定义字段与数据备份，全部界面自助维护，无需改代码。
        </p>
      </header>
      <Tabs defaultValue="dict">
        <TabsList>
          <TabsTrigger value="dict">字典管理</TabsTrigger>
          <TabsTrigger value="mapping">导入映射</TabsTrigger>
          <TabsTrigger value="template">导出模板</TabsTrigger>
          <TabsTrigger value="fields">自定义字段</TabsTrigger>
          <TabsTrigger value="backup">数据备份</TabsTrigger>
        </TabsList>
        <TabsContent value="dict">
          <DictManager />
        </TabsContent>
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
      </Tabs>
    </div>
  )
}
