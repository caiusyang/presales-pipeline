package com.presales.pipeline.tasks;

import com.presales.pipeline.importing.ImportRecordProcessor;
import com.presales.pipeline.importing.dto.*;
import com.presales.pipeline.exporting.ExportService;
import com.presales.pipeline.exporting.dto.*;
import com.presales.pipeline.common.exception.BusinessException;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.*;

@Service
public class BatchJobRunner {
    private final JobStore store; private final JobItemWorker worker; private final ExportService exports;
    private final com.presales.pipeline.importing.ImportBatchLookup lookups;
    private final TaskHistoryService history;
    private final ExecutorService executor=Executors.newFixedThreadPool(2,r->{Thread t=new Thread(r,"batch-job");t.setDaemon(true);return t;});
    public BatchJobRunner(JobStore store,JobItemWorker worker,ExportService exports,com.presales.pipeline.importing.ImportBatchLookup lookups,TaskHistoryService history){this.store=store;this.worker=worker;this.exports=exports;this.lookups=lookups;this.history=history;}
    @EventListener(ApplicationReadyEvent.class) public void onStartup(){store.interruptUnfinished();history.cleanup();}
    @PreDestroy public void shutdown(){executor.shutdown();try{if(!executor.awaitTermination(5,TimeUnit.SECONDS))executor.shutdownNow();}catch(InterruptedException e){Thread.currentThread().interrupt();}}
    public synchronized BatchJob submit(String key,String kind,Object payload,String operator){var job=store.submit(key,kind,payload,operator);if(job.status.equals("QUEUED"))executor.submit(()->run(job.id));return job;}
    public synchronized BatchJob retry(String id,String key){var job=store.retry(id,key);if(job.status.equals("QUEUED"))executor.submit(()->run(id));return job;}
    private void run(String id){
        if(!store.start(id))return;
        var job=store.get(id);
        var context=SecurityContextHolder.createEmptyContext();context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(job.operator,null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));SecurityContextHolder.setContext(context);
        try{
            if(store.countItems(id)==0){
                if(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT"))store.initialize(id,store.read(job.payload,ImportRequest.class).records(),null);
                else if(job.kind.equals("PROGRESS_REPAIR"))store.initialize(id,Arrays.asList(store.read(job.payload,com.presales.pipeline.progress.ProgressRepairService.Repair[].class)),null);
                else if(job.kind.equals("PEOPLE_IMPORT"))store.initialize(id,Arrays.asList(store.read(job.payload,com.presales.pipeline.people.PeopleService.Input[].class)),null);
                else if(job.kind.equals("EXPORT")){
                    var request=store.read(job.payload,ExportRequest.class);var ids=exports.projectIdsForExport(request);
                    List<ExportRequest> chunks=new ArrayList<>();List<Integer> weights=new ArrayList<>();
                    for(int start=0;start<ids.size();start+=100){var chunk=ids.subList(start,Math.min(start+100,ids.size()));var f=request.filters();
                        var filters=new ExportFilters(chunk,f==null?null:f.industry(),f==null?null:f.track(),f==null?null:f.keyword(),f==null?null:f.startMonth(),f==null?null:f.endMonth(),f==null?null:f.startDate(),f==null?null:f.endDate());
                        chunks.add(new ExportRequest(request.templateId(),request.scope(),request.columns(),filters));weights.add(chunk.size());}
                    // Empty exports still validate and preserve columns in their result.
                    if(chunks.isEmpty()){var f=request.filters();chunks.add(new ExportRequest(request.templateId(),request.scope(),request.columns(),new ExportFilters(List.of(-1L),f==null?null:f.industry(),f==null?null:f.track(),f==null?null:f.keyword(),f==null?null:f.startMonth(),f==null?null:f.endMonth(),f==null?null:f.startDate(),f==null?null:f.endDate())));weights.add(0);}store.initialize(id,chunks,weights);
                }else store.initialize(id,store.read(job.payload,Long[].class)==null?List.of():Arrays.asList(store.read(job.payload,Long[].class)),null);
            }
            Set<String> seen=new HashSet<>();
            var preparedImport=job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")?store.read(job.payload,ImportRequest.class):null;
            for(var item:store.results(id))if(item.status.equals("SUCCESS")&&(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")))remember(seen,store.read(item.resultData,ImportRecordResult.class));
            while(!Thread.currentThread().isInterrupted()){
                var items=store.pending(id);if(items.isEmpty())break;
                try(var referenceScope=com.presales.pipeline.importing.ImportReferenceScope.open()) {
                    if(preparedImport!=null)lookups.preload(items.stream().map(item->store.read(item.inputData,ImportRecordRequest.class)).toList());
                    for(var item:items){if(Thread.currentThread().isInterrupted())throw new InterruptedException();
                    try{Object result=worker.execute(job,preparedImport,item.id,seen);if(result instanceof ImportRecordResult row)remember(seen,row);}
                    catch(com.presales.pipeline.importing.ImportValidationException error){var row=store.read(item.inputData,ImportRecordRequest.class);store.fail(item.id,error.getMessage(),new ImportRecordResult(item.itemIndex+1,"skipped",null,null,String.valueOf(row.fields().getOrDefault("customerName","")),String.valueOf(row.fields().getOrDefault("projectName","")),error.getMessage(),row.sourceRow(),error.getIssues(),error.getEffectiveFields()));}
                    catch(Exception error){store.fail(item.id,error.getMessage(),null);}
                }}store.refresh(id,false);
            }
            if(job.kind.equals("PROJECT_PURGE"))history.cleanup();
            if(Thread.currentThread().isInterrupted())store.interrupt(id,"任务已中断，成功项保留");else store.refresh(id,true);
        }catch(Exception error){store.refresh(id,false);store.interrupt(id,error.getMessage());}finally{try{history.cleanup();}catch(Exception error){org.slf4j.LoggerFactory.getLogger(getClass()).error("任务历史清理失败，将在下次任务或启动时重试",error);}SecurityContextHolder.clearContext();}
    }
    private void remember(Set<String> seen,ImportRecordResult row){seen.addAll(ImportRecordProcessor.identities(row.projectId(),row.externalId(),row.customerName(),row.projectName()));}
    public Object result(String id){
        var job=store.get(id);var items=store.results(id);
        if(List.of("QUEUED","RUNNING","INTERRUPTED").contains(job.status))throw BusinessException.conflict("任务尚未完成，请查看进度或重试未完成项");
        if(job.kind.equals("EXPORT")){
            if(items.stream().anyMatch(i->!i.status.equals("SUCCESS")))throw BusinessException.conflict("导出结果不完整或已清理，请先重试失败分块再下载");
            List<Map<String,Object>> rows=new ArrayList<>();ExportResponse first=null;
            for(var item:items)if(item.status.equals("SUCCESS")){var part=store.read(item.resultData,ExportResponse.class);if(first==null)first=part;rows.addAll(part.rows());}
            if(first==null)throw BusinessException.conflict("没有可下载的导出结果");return new ExportResponse(first.scope(),first.columns(),rows,rows.size(),job.updatedAt);
        }
        if(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")){
            List<ImportRecordResult> rows=new ArrayList<>();int added=0,updated=0,skipped=0;
            for(var item:items){if(item.status.equals("SUCCESS")){var row=store.read(item.resultData,ImportRecordResult.class);rows.add(row);if(row.status().equals("added"))added++;else updated++;}
                else {var row=store.read(item.inputData,ImportRecordRequest.class);rows.add(item.resultData!=null?store.read(item.resultData,ImportRecordResult.class):new ImportRecordResult(item.itemIndex+1,"skipped",null,null,String.valueOf(row.fields().getOrDefault("customerName","")),String.valueOf(row.fields().getOrDefault("projectName","")),item.error,row.sourceRow(),List.of(new ImportIssue("_record","validation",item.error)),row.fields()));skipped++;}}
            return new ImportResponse(job.kind.equals("PREFLIGHT"),store.read(job.payload,ImportRequest.class).mappingId(),added,updated,skipped,rows);
        }
        if(job.kind.equals("PEOPLE_IMPORT"))return Map.of("succeeded",job.succeeded,"failed",job.failed,"details",items.stream().map(item->{var value=new LinkedHashMap<String,Object>();value.put("index",item.itemIndex);value.put("status",item.status);value.put("error",item.error);value.put("input",store.read(item.inputData,Object.class));value.put("result",item.resultData==null?null:store.read(item.resultData,Object.class));return value;}).toList());
        var successes=new ArrayList<Long>();var failures=new ArrayList<Map<String,Object>>();
        for(var item:items){Long project=job.kind.equals("PROGRESS_REPAIR")?store.read(item.inputData,com.presales.pipeline.progress.ProgressRepairService.Repair.class).id():store.read(item.inputData,Long.class);if(item.status.equals("SUCCESS"))successes.add(project);else failures.add(Map.of("id",project,"message",item.error==null?"执行未完成":item.error));}
        return Map.of("deletedIds",successes,"failures",failures);
    }
}
