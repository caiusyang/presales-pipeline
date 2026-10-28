package com.presales.pipeline.tasks;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.importing.dto.ImportRecordRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import jakarta.persistence.*;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/** Project hard-delete also erases task copies; all task readers sanitize against committed tombstones. */
@Service
public class TaskHistoryService {
    private static final String REMOVED="项目已永久删除，任务原文及结果快照已清理；旧任务不能恢复该项目";
    private final PurgedProjectSnapshotRepository tombstones;private final BatchJobRepository jobs;private final BatchJobItemRepository items;private final ObjectMapper mapper;private final com.presales.pipeline.audit.ChangeLogRepository changes;
    private static final ThreadLocal<BatchJob> CURRENT=new ThreadLocal<>();
    @PersistenceContext private EntityManager em;
    public TaskHistoryService(PurgedProjectSnapshotRepository tombstones,BatchJobRepository jobs,BatchJobItemRepository items,ObjectMapper mapper,com.presales.pipeline.audit.ChangeLogRepository changes){this.tombstones=tombstones;this.jobs=jobs;this.items=items;this.mapper=mapper;this.changes=changes;}
    public void enter(BatchJob job){CURRENT.set(job);}
    public void leave(){CURRENT.remove();}
    public boolean isBatchPurge(){var job=CURRENT.get();return job!=null&&job.kind.equals("PROJECT_PURGE");}
    @Transactional(readOnly=true) public void assertCurrentImportAllowed(ImportRecordRequest record){var job=CURRENT.get();if(job==null)return;Map<String,Object> fields=record.fields();if(Boolean.TRUE.equals(fields.get("_purged"))||matches(fields,targets(job)))throw BusinessException.conflict(REMOVED);}
    @Transactional public void record(Project project,List<Long> progressIds){
        var marker=new PurgedProjectSnapshot();marker.projectId=project.getId();marker.purgedAt=JobStore.now();marker.progressIds=new ArrayList<>(progressIds);
        Set<String> identities=new HashSet<>(keys(project.getId(),project.getExternalId(),project.getCustomerName(),project.getProjectName(),project.getHcsOpportunityId()));
        for(var change:changes.identityHistory(project.getId())){if(change[0]!=null)identities.addAll(valueKeys(object(String.valueOf(change[0]))));if(change[1]!=null)identities.addAll(valueKeys(object(String.valueOf(change[1]))));}
        marker.identityHashes=new ArrayList<>(identities);tombstones.saveAndFlush(marker);
    }
    /** Called after the deleting transaction committed, so cleanup cannot deadlock on that project's row lock. */
    @Transactional(propagation=Propagation.REQUIRES_NEW,isolation=Isolation.READ_COMMITTED)
    public void cleanup(){
        var all=tombstones.findAll();if(all.isEmpty())return;
        for(var job:jobs.findAll()){
            var relevant=all.stream().filter(t->!t.purgedAt.isBefore(job.createdAt)).toList();if(relevant.isEmpty())continue;
            boolean changed=false;
            String payload=cleanPayload(job,relevant);if(!Objects.equals(payload,job.payload))changed=true;
            for(var item:items.findByJobIdOrderByItemIndex(job.id)){
                if(!affected(job,item,relevant))continue;
                em.refresh(item,LockModeType.PESSIMISTIC_WRITE);
                if(clean(job,item,relevant))changed=true;
            }
            if(changed){
                // The job runner may have updated progress while cleanup waited on an item transaction.
                em.flush();em.refresh(job,LockModeType.PESSIMISTIC_WRITE);job.payload=cleanPayload(job,relevant);job.error=job.error==null?null:REMOVED;
                var rows=items.findByJobIdOrderByItemIndex(job.id);job.processed=rows.stream().filter(i->!i.status.equals("PENDING")).mapToInt(i->i.weight).sum();job.succeeded=rows.stream().filter(i->i.status.equals("SUCCESS")).mapToInt(i->i.weight).sum();job.failed=rows.stream().filter(i->i.status.equals("FAILED")).mapToInt(i->i.weight).sum();
                if(!List.of("RUNNING","QUEUED","INTERRUPTED").contains(job.status))job.status=rows.stream().noneMatch(i->i.status.equals("FAILED"))?"SUCCEEDED":job.succeeded>0?"PARTIAL":"FAILED";job.updatedAt=JobStore.now();
            }
        }
    }
    public List<PurgedProjectSnapshot> targets(BatchJob job){return tombstones.findAll().stream().filter(t->!t.purgedAt.isBefore(job.createdAt)).toList();}
    public List<BatchJobItem> copies(BatchJob job,List<BatchJobItem> rows){
        var relevant=targets(job);if(relevant.isEmpty())return rows;
        return rows.stream().map(item->{var copy=mapper.convertValue(item,BatchJobItem.class);clean(job,copy,relevant);return copy;}).toList();
    }
    public BatchJob copyJob(BatchJob job){var copy=mapper.convertValue(job,BatchJob.class);copy.payload=cleanPayload(job,targets(job));return copy;}
    public List<Map<String,Object>> backupMarkers(){var type=new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){};return tombstones.findAll().stream().map(t->mapper.convertValue(t,type)).toList();}
    private boolean affected(BatchJob job,BatchJobItem item,List<PurgedProjectSnapshot> targets){
        if(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")){var input=object(item.inputData);var fields=map(input.get("fields"));return matches(fields,targets)||Boolean.TRUE.equals(fields.get("_purged"))||item.resultData!=null&&matches(object(item.resultData),targets);}
        if(job.kind.equals("EXPORT"))return hasRemovedExportId(object(item.inputData),targets);
        if(job.kind.equals("PROGRESS_REPAIR")){var input=object(item.inputData);return Boolean.TRUE.equals(input.get("_purged"))||targets.stream().anyMatch(t->t.progressIds.contains(number(input.get("id"))));}
        return false;
    }
    private boolean clean(BatchJob job,BatchJobItem item,List<PurgedProjectSnapshot> targets){
        if(!affected(job,item,targets))return false;
        String originalInput=item.inputData,originalResult=item.resultData,originalError=item.error,originalStatus=item.status;
        if(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")){
            var input=object(item.inputData);var result=item.resultData==null?new LinkedHashMap<String,Object>():object(item.resultData);
            item.inputData=json(scrubRecord(input));var removed=new LinkedHashMap<String,Object>();removed.put("row",item.itemIndex+1);removed.put("sourceRow",input.get("sourceRow"));removed.put("projectId",result.get("projectId"));removed.put("externalId",null);removed.put("customerName","");removed.put("projectName","");removed.put("status",item.status.equals("SUCCESS")?result.getOrDefault("status","skipped"):"skipped");removed.put("reason",REMOVED);removed.put("issues",List.of());removed.put("effectiveFields",Map.of());item.resultData=json(removed);
            if(!item.status.equals("SUCCESS")){item.status="FAILED";item.error=REMOVED;}else item.error=null;
        }else if(job.kind.equals("EXPORT")){
            item.inputData=json(scrubExport(object(item.inputData),targets));item.resultData=null;item.status="FAILED";item.error="导出分块包含已永久删除的项目，结果已清理；重试只导出剩余项目";
        }else if(job.kind.equals("PROGRESS_REPAIR")){
            var input=object(item.inputData);var clean=new LinkedHashMap<String,Object>();clean.put("id",input.get("id"));clean.put("_purged",true);clean.put("expectedLogDate",null);clean.put("expectedContent","");clean.put("logDate",null);clean.put("content","");clean.put("evidence","");item.inputData=json(clean);item.resultData=json(Map.of("id",input.get("id"),"removed",true));if(!item.status.equals("SUCCESS")){item.status="FAILED";item.error=REMOVED;}else item.error=null;
        }
        return !Objects.equals(originalInput,item.inputData)||!Objects.equals(originalResult,item.resultData)||!Objects.equals(originalError,item.error)||!Objects.equals(originalStatus,item.status);
    }
    private String cleanPayload(BatchJob job,List<PurgedProjectSnapshot> targets){
        if(targets.isEmpty())return job.payload;
        if(job.kind.equals("IMPORT")||job.kind.equals("PREFLIGHT")){var payload=object(job.payload);var removedIndices=new HashSet<Integer>();for(var item:items.findByJobIdOrderByItemIndex(job.id))if(affected(job,item,targets))removedIndices.add(item.itemIndex);if(payload.get("records") instanceof List<?> records){var cleanRows=new ArrayList<>();for(int index=0;index<records.size();index++){var row=map(records.get(index));cleanRows.add(removedIndices.contains(index)||matches(map(row.get("fields")),targets)?scrubRecord(row):row);}payload.put("records",cleanRows);}return json(payload);}
        if(job.kind.equals("EXPORT"))return json(scrubExport(object(job.payload),targets));
        if(job.kind.equals("PROGRESS_REPAIR")){var rows=read(job.payload,List.class);return json(rows.stream().map(raw->{var row=map(raw);if(targets.stream().anyMatch(t->t.progressIds.contains(number(row.get("id"))))){var clean=new LinkedHashMap<String,Object>();clean.put("id",row.get("id"));clean.put("_purged",true);return clean;}return row;}).toList());}
        return job.payload;
    }
    private Map<String,Object> scrubRecord(Map<String,Object> input){var clean=new LinkedHashMap<String,Object>();clean.put("sourceRow",input.get("sourceRow"));clean.put("fields",Map.of("_purged",true));clean.put("revenues",List.of());clean.put("progress",List.of());return clean;}
    private boolean hasRemovedExportId(Map<String,Object> input,List<PurgedProjectSnapshot> targets){var filters=map(input.get("filters"));if(!(filters.get("projectIds") instanceof List<?> ids))return false;return ids.stream().map(this::number).anyMatch(id->targets.stream().anyMatch(t->t.projectId.equals(id)));}
    private Map<String,Object> scrubExport(Map<String,Object> input,List<PurgedProjectSnapshot> targets){if(!hasRemovedExportId(input,targets))return input;var filters=map(input.get("filters"));var ids=((List<?>)filters.get("projectIds")).stream().map(this::number).filter(id->targets.stream().noneMatch(t->t.projectId.equals(id))).toList();filters.put("projectIds",ids.isEmpty()?List.of(-1L):ids);input.put("filters",filters);return input;}
    private Set<String> valueKeys(Map<String,Object> values){return keys(number(values.getOrDefault("projectId",values.get("id"))),text(value(values,"externalId","external_id")),text(value(values,"customerName","customer_name")),text(value(values,"projectName","project_name")),text(value(values,"hcsOpportunityId","hcs_opportunity_id")));}
    private boolean matches(Map<String,Object> values,List<PurgedProjectSnapshot> targets){var keys=valueKeys(values);return targets.stream().anyMatch(t->t.identityHashes.stream().anyMatch(keys::contains));}
    private Object value(Map<String,Object> values,String name,String legacy){return values.containsKey(name)?values.get(name):values.get(legacy);}
    private Set<String> keys(Long id,String external,String customer,String project,String hcs){Set<String> keys=new HashSet<>();if(id!=null)keys.add(hash("id:"+id));if(external!=null&&!external.isBlank())keys.add(hash("ext:"+external.trim().toLowerCase(Locale.ROOT)));if(customer!=null&&project!=null&&!customer.isBlank()&&!project.isBlank())keys.add(hash("name:"+customer.trim().toLowerCase(Locale.ROOT)+"\u0000"+project.trim().toLowerCase(Locale.ROOT)));if(hcs!=null&&!hcs.isBlank())keys.add(hash("hcs:"+hcs.trim().toLowerCase(Locale.ROOT)));return keys;}
    private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private String text(Object value){return value==null?null:String.valueOf(value);}
    private Long number(Object value){try{return value==null?null:Long.valueOf(String.valueOf(value));}catch(NumberFormatException e){return null;}}
    @SuppressWarnings("unchecked") private Map<String,Object> map(Object value){return value instanceof Map<?,?>?new LinkedHashMap<>((Map<String,Object>)value):new LinkedHashMap<>();}
    private Map<String,Object> object(String value){return map(read(value,Object.class));}
    private <T>T read(String value,Class<T> type){try{return mapper.readValue(value,type);}catch(Exception e){throw new IllegalStateException("无法读取任务快照",e);}}
    private String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
}
