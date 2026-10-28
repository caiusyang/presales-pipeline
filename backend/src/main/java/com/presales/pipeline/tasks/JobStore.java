package com.presales.pipeline.tasks;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.presales.pipeline.common.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class JobStore {
    final BatchJobRepository jobs; final BatchJobItemRepository items; final ObjectMapper mapper; private final TaskHistoryService history;
    public JobStore(BatchJobRepository jobs,BatchJobItemRepository items,ObjectMapper mapper,TaskHistoryService history) {this.jobs=jobs;this.items=items;this.mapper=mapper;this.history=history;}
    public static LocalDateTime now(){return LocalDateTime.now(ZoneId.of("Asia/Shanghai"));}
    public String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw BusinessException.badRequest("任务数据无法序列化");}}
    public <T>T read(String value,Class<T> type){try{return mapper.readValue(value,type);}catch(Exception e){throw BusinessException.badRequest("任务数据格式不正确");}}
    @Transactional public synchronized BatchJob submit(String requestKey,String kind,Object payload,String operator){
        if(requestKey==null||requestKey.isBlank()||requestKey.length()>128)throw BusinessException.badRequest("必须提供1至128字符的唯一请求标识");
        String serialized=json(payload), hash;
        try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((kind+serialized).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}
        var existing=jobs.findByRequestKey(requestKey);
        if(existing.isPresent()) {if(!existing.get().payloadHash.equals(hash))throw BusinessException.conflict("同一请求标识不能用于不同任务");return existing.get();}
        BatchJob job=new BatchJob();job.id=UUID.randomUUID().toString();job.requestKey=requestKey;job.kind=kind;job.payloadHash=hash;
        job.payload=serialized;job.operator=operator;job.status="QUEUED";job.createdAt=job.updatedAt=now();return jobs.saveAndFlush(job);
    }
    @Transactional(readOnly=true) public BatchJob get(String id){return jobs.findById(id).orElseThrow(()->BusinessException.notFound("任务不存在"));}
    @Transactional(readOnly=true) public List<BatchJob> list(){return jobs.findTop30ByOrderByCreatedAtDesc();}
    @Transactional public boolean start(String id){var job=jobs.lock(id).orElseThrow();if(!job.status.equals("QUEUED"))return false;job.status="RUNNING";job.updatedAt=now();return true;}
    @Transactional public void initialize(String id,List<?> inputs,List<Integer> weights){
        BatchJob job=jobs.lock(id).orElseThrow();if(items.countByJobId(id)>0)return;
        int total=0;for(int n=0;n<inputs.size();n++){var item=new BatchJobItem();item.jobId=id;item.itemIndex=n;item.inputData=json(inputs.get(n));item.weight=weights==null?1:weights.get(n);items.save(item);total+=item.weight;}
        job.total=total;job.updatedAt=now();
    }
    @Transactional(readOnly=true) public List<BatchJobItem> pending(String id){return items.findByJobIdAndStatusOrderByItemIndex(id,"PENDING",PageRequest.of(0,100));}
    @Transactional(readOnly=true) public List<BatchJobItem> results(String id){return history.copies(get(id),items.findByJobIdOrderByItemIndex(id));}
    @Transactional(readOnly=true) public org.springframework.data.domain.Page<BatchJobItem> page(String id,int page,int size){var job=get(id);var rows=items.findByJobIdOrderByItemIndex(id,PageRequest.of(page,size));return new org.springframework.data.domain.PageImpl<>(history.copies(job,rows.getContent()),rows.getPageable(),rows.getTotalElements());}
    @Transactional(readOnly=true) public long countItems(String id){return items.countByJobId(id);}
    @Transactional public BatchJobItem lockItem(Long id){return items.lock(id).orElseThrow();}
    @Transactional public void fail(Long id,String reason,Object result){var item=items.lock(id).orElseThrow();if(item.status.equals("SUCCESS"))return;item.status="FAILED";item.error=reason==null?"执行失败":reason;item.resultData=result==null?null:json(result);}
    @Transactional public void refresh(String id,boolean finished){
        var job=jobs.lock(id).orElseThrow();job.processed=0;job.succeeded=0;job.failed=0;
        boolean anyFailed=false;
        for(var row:items.counts(id)){int count=((Number)row[1]).intValue();if(!row[0].equals("PENDING"))job.processed+=count;if(row[0].equals("SUCCESS"))job.succeeded=count;if(row[0].equals("FAILED")){job.failed=count;anyFailed=true;}}
        if(finished)job.status=!anyFailed?"SUCCEEDED":job.succeeded>0?"PARTIAL":"FAILED";job.updatedAt=now();
    }
    @Transactional public void interrupt(String id,String reason){var job=jobs.lock(id).orElseThrow();job.status="INTERRUPTED";job.error=reason;job.updatedAt=now();}
    @Transactional public void interruptUnfinished(){jobs.findByStatusIn(List.of("QUEUED","RUNNING")).forEach(j->{j.status="INTERRUPTED";j.error="服务已重启；已完成结果保留，请重试未成功项";j.updatedAt=now();});}
    @Transactional public BatchJob retry(String id,String requestKey){
        if(requestKey==null||requestKey.isBlank()||requestKey.length()>128)throw BusinessException.badRequest("必须提供重试请求唯一标识");
        var job=jobs.lock(id).orElseThrow(()->BusinessException.notFound("任务不存在"));
        if(requestKey.equals(job.retryKey)||List.of("RUNNING","QUEUED","SUCCEEDED").contains(job.status))return job;
        job.retryKey=requestKey;job.status="QUEUED";job.error=null;job.updatedAt=now();
        items.findByJobIdOrderByItemIndex(id).stream().filter(i->i.status.equals("FAILED")).forEach(i->{i.status="PENDING";i.error=null;});return job;
    }
    public Map<String,Object> view(BatchJob j){var v=new LinkedHashMap<String,Object>();v.put("id",j.id);v.put("kind",j.kind);v.put("status",j.status);v.put("total",j.total);v.put("processed",j.processed);v.put("succeeded",j.succeeded);v.put("failed",j.failed);v.put("error",j.error);v.put("createdAt",j.createdAt);v.put("updatedAt",j.updatedAt);return v;}
    @Transactional(readOnly=true) public Map<String,List<Map<String,Object>>> backup(){
        var type=new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){};
        var all=jobs.findAll();var safeItems=all.stream().flatMap(j->history.copies(j,items.findByJobIdOrderByItemIndex(j.id)).stream()).map(i->mapper.convertValue(i,type)).toList();
        return Map.of("batch_jobs",all.stream().map(history::copyJob).map(j->mapper.convertValue(j,type)).toList(),"batch_job_items",safeItems,"purged_project_snapshots",history.backupMarkers());
    }
}
