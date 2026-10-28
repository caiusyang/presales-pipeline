package com.presales.pipeline.tasks;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.project.ProjectService;
import com.presales.pipeline.importing.ImportRecordProcessor;
import com.presales.pipeline.importing.dto.*;
import com.presales.pipeline.exporting.ExportService;
import com.presales.pipeline.exporting.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;

@Service
public class JobItemWorker {
    private final JobStore store; private final ProjectService projects; private final ImportRecordProcessor importer; private final ExportService exports;private final com.presales.pipeline.progress.ProgressRepairService repairs;
    private final com.presales.pipeline.importing.ImportReferenceCache references;
    private final com.presales.pipeline.people.PeopleService people;
    private final TaskHistoryService history;
    public JobItemWorker(JobStore store,ProjectService projects,ImportRecordProcessor importer,ExportService exports,com.presales.pipeline.progress.ProgressRepairService repairs,com.presales.pipeline.importing.ImportReferenceCache references,com.presales.pipeline.people.PeopleService people,TaskHistoryService history){this.store=store;this.projects=projects;this.importer=importer;this.exports=exports;this.repairs=repairs;this.references=references;this.people=people;this.history=history;}
    @Transactional(propagation=Propagation.REQUIRES_NEW,isolation=Isolation.READ_COMMITTED)
    public Object execute(String jobId,Long itemId,Set<String> seen){
        return execute(store.get(jobId),null,itemId,seen);
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW,isolation=Isolation.READ_COMMITTED)
    public Object execute(BatchJob job,ImportRequest prepared,Long itemId,Set<String> seen){
        BatchJobItem item=store.lockItem(itemId);
        if(item.status.equals("SUCCESS"))return store.read(item.resultData,Object.class);
        history.enter(job);
        try {
        Object result;
        if(job.kind.startsWith("PROJECT_")){
            Long id=store.read(item.inputData,Long.class);
            switch(job.kind){case "PROJECT_DELETE"->projects.delete(id);case "PROJECT_RESTORE"->projects.restore(id);case "PROJECT_PURGE"->projects.permanentlyDelete(id);default->throw BusinessException.badRequest("未知批量操作");}
            result=Map.of("id",id);
        }else if(job.kind.equals("PEOPLE_IMPORT")){var person=people.importOne(store.read(item.inputData,com.presales.pipeline.people.PeopleService.Input.class));result=Map.of("id",person.getId(),"name",person.getName());
        }else if(job.kind.equals("PROGRESS_REPAIR")){if(Boolean.TRUE.equals(store.read(item.inputData,Map.class).get("_purged")))throw BusinessException.conflict("项目已永久删除，旧修复任务不能恢复进展");result=Map.of("id",repairs.apply(store.read(item.inputData,com.presales.pipeline.progress.ProgressRepairService.Repair.class)));
        }else if(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")){
            references.refresh();
            var request=prepared==null?store.read(job.payload,ImportRequest.class):prepared;var record=store.read(item.inputData,ImportRecordRequest.class);
            history.assertCurrentImportAllowed(record);
            var processed=importer.processJoined(record,request.dryRun(),request.pendingFields(),seen);
            result=new ImportRecordResult(item.itemIndex+1,processed.action().name().toLowerCase(Locale.ROOT),processed.projectId(),processed.externalId(),processed.customerName(),processed.projectName(),null,record.sourceRow(),List.of(),processed.effectiveFields());
        }else if(job.kind.equals("EXPORT")){
            result=exports.export(store.read(item.inputData,ExportRequest.class));
        }else throw BusinessException.badRequest("未知任务类型");
        item.resultData=store.json(result);item.status="SUCCESS";item.error=null;return result;
        } finally {history.leave();}
    }
}
