import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Table } from './table'
import { Tabs, TabsList, TabsTrigger } from './tabs'
import { DialogFooter, DialogHeader } from './dialog'
import { DrawerBody, DrawerFooter } from './drawer'
import { Input } from './input'
import { Select } from './select'
import { ExportColumnConfig } from '../impexp/ExportColumnConfig'

describe('responsive layout safeguards', () => {
  it('contains wide tables in a local scroll area', () => {
    const html = renderToStaticMarkup(<Table><tbody><tr><td>宽表内容</td></tr></tbody></Table>)
    expect(html).toContain('min-w-0')
    expect(html).toContain('overflow-auto')
  })

  it('allows long tab groups to wrap instead of overflowing', () => {
    const html = renderToStaticMarkup(<Tabs defaultValue="a"><TabsList><TabsTrigger value="a">自定义字段</TabsTrigger><TabsTrigger value="b">进展日期修复</TabsTrigger></TabsList></Tabs>)
    expect(html).toContain('flex-wrap')
    expect(html).toContain('max-w-full')
    const tabListClasses = html.match(/role="tablist"[^>]*class="([^"]*)"/)?.[1].split(/\s+/)
    expect(tabListClasses).not.toContain('h-9')
  })

  it('keeps dialog actions wrap-safe and leaves room for the close button', () => {
    expect(renderToStaticMarkup(<DialogFooter><button>取消</button><button>确认执行</button></DialogFooter>)).toContain('flex-wrap')
    expect(renderToStaticMarkup(<DialogHeader>较长的标题和说明</DialogHeader>)).toContain('pr-6')
    expect(renderToStaticMarkup(<DrawerFooter>操作</DrawerFooter>)).toContain('flex-wrap')
    expect(renderToStaticMarkup(<DrawerBody>内容</DrawerBody>)).toContain('min-w-0')
  })

  it('aligns the two export lists while keeping long fields and accessible controls', () => {
    const html = renderToStaticMarkup(<ExportColumnConfig
      fields={[{ key: 'custom.a_very_long_field_identifier', title: '自定义字段的完整中文名称' }]}
      columns={[{ key: 'custom.a_very_long_field_identifier', title: '保留我的导出列名' }]}
      onChange={() => {}}
    />)
    expect(html.match(/h-80/g)).toHaveLength(2)
    expect(html.match(/min-h-24/g)).toHaveLength(2)
    expect(html).toContain('自定义字段的完整中文名称')
    expect(html).toContain('保留我的导出列名')
    expect(html).toContain('aria-label="第 1 列名称"')
    expect(html).toContain('aria-label="移除第 1 列"')
  })

  it('retains the selected-list height when no export field is selected', () => {
    const html = renderToStaticMarkup(<ExportColumnConfig fields={[]} columns={[]} onChange={() => {}} />)
    expect(html).toContain('尚未选择列')
    expect(html).toContain('flex h-80 items-center justify-center')
  })

  it('allows date inputs and long native selects to shrink inside a grid', () => {
    expect(renderToStaticMarkup(<Input type="month" />)).toContain('min-w-0')
    const html = renderToStaticMarkup(<Select value="long" options={[{ value: 'long', label: '较长的解决方案完整名称' }]} onValueChange={() => {}} />)
    expect(html.match(/min-w-0/g)).toHaveLength(2)
    expect(html).toContain('较长的解决方案完整名称')
  })
})
