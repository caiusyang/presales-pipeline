import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, FileSpreadsheet, FileDown, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadImportSample, MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS, parseExcelFile } from './excel'
import type { ParsedSheet } from './excel'

const PREVIEW_ROWS = 20

interface Props {
  parsed: ParsedSheet | null
  onParsed: (p: ParsedSheet) => void
  onNext: () => void
}

/** 导入第 1 步：上传文件本地解析 + 预览前 20 行 + 下载示例 */
export function StepUpload({ parsed, onParsed, onNext }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)

  const handleFile = async (file: File) => {
    setParsing(true)
    try {
      const p = await parseExcelFile(file)
      onParsed(p)
      toast.success(`解析成功：${p.sheetName}，识别 ${p.headerRows} 行表头、${p.totalRows} 行数据`)
    } catch (e) {
      toast.error(`解析失败：${(e as Error).message || '无法读取该文件'}`)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">上传 Excel 文件</CardTitle>
          <CardDescription>
            支持 .xlsx / .xls / .csv，最大 {MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB、{MAX_IMPORT_ROWS} 行；
            仅读取第一个工作表，文件不会上传到服务器
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={parsing}>
            <Upload /> {parsing ? '解析中…' : parsed ? '重新选择文件' : '选择文件'}
          </Button>
          <Button variant="outline" onClick={downloadImportSample}>
            <FileDown /> 下载导入示例
          </Button>
          {parsed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              工作表 <Badge variant="secondary">{parsed.sheetName}</Badge>
              表头行 <Badge variant="secondary">{parsed.headerRows}</Badge>
              数据行 <Badge variant="secondary">{parsed.totalRows}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">数据预览</CardTitle>
            <CardDescription>
              已按合并关系识别 {parsed.headerRows} 行表头；仅预览前 {PREVIEW_ROWS} 行数据
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-12 text-center">#</TableHead>
                    {parsed.headers.map((h, i) => (
                      <TableHead key={i} className="font-semibold text-foreground">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, PREVIEW_ROWS).map((row, r) => (
                    <TableRow key={r}>
                      <TableCell className="text-center text-xs text-muted-foreground">{r + 2}</TableCell>
                      {parsed.headers.map((_, c) => (
                        <TableCell key={c} className="max-w-56 truncate whitespace-nowrap" title={row[c] ?? ''}>
                          {row[c] ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.totalRows > PREVIEW_ROWS && (
              <div className="mt-2 text-xs text-muted-foreground">… 其余 {parsed.totalRows - PREVIEW_ROWS} 行未展示</div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!parsed}>
          下一步：映射调整 <ArrowRight />
        </Button>
      </div>
    </div>
  )
}
