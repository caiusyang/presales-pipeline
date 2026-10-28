package com.presales.pipeline.importing;
import com.presales.pipeline.project.*;
import com.presales.pipeline.product.*;
import com.presales.pipeline.progress.*;
import com.presales.pipeline.importing.dto.ImportRecordRequest;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
/** Immutable 100-row snapshots. Positive cached children are used only when the locked project version still matches. */
@Service
public class ImportBatchLookup {
    @PersistenceContext private EntityManager em;
    private final ProgressLogRepository progress;private final ProjectProductRepository products;
    public ImportBatchLookup(ProgressLogRepository progress,ProjectProductRepository products){this.progress=progress;this.products=products;}
    public record Candidate(Long id,long version,String externalId,String customer,String name,boolean deleted){}
    public record Owned(Long id,String code){}
    public record Snapshot(Map<String,Candidate> external,Map<String,Candidate> names,Map<Long,Long> versions,Map<Long,Set<String>> progress,Map<Long,List<Owned>> products){}
    public static String pair(String customer,String name){return String.valueOf(customer).trim().toLowerCase(Locale.ROOT)+"\u0000"+String.valueOf(name).trim().toLowerCase(Locale.ROOT);}
    public static String progressKey(java.time.LocalDate date,String content){return date+"\u0000"+content.trim();}
    @Transactional(readOnly=true) public void preload(List<ImportRecordRequest> rows){
        var cb=em.getCriteriaBuilder();var query=cb.createQuery(Project.class);var p=query.from(Project.class);var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>();
        for(var row:rows){var f=row.fields();String ext=text(f,"externalId","external_id"),customer=text(f,"customerName","customer_name"),name=text(f,"projectName","project_name");if(!ext.isEmpty())predicates.add(cb.equal(cb.lower(p.get("externalId")),ext.toLowerCase(Locale.ROOT)));if(!customer.isEmpty()&&!name.isEmpty())predicates.add(cb.and(cb.equal(cb.lower(p.get("customerName")),customer.toLowerCase(Locale.ROOT)),cb.equal(cb.lower(p.get("projectName")),name.toLowerCase(Locale.ROOT))));}
        var projects=predicates.isEmpty()?List.<Project>of():em.createQuery(query.select(p).where(cb.or(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new)))).getResultList();
        Map<String,Candidate> external=new HashMap<>(),names=new HashMap<>();Map<Long,Long> versions=new HashMap<>();
        for(var project:projects){var c=new Candidate(project.getId(),project.getRowVersion(),project.getExternalId(),project.getCustomerName(),project.getProjectName(),project.isDeleted());if(c.externalId()!=null)external.put(c.externalId().toLowerCase(Locale.ROOT),c);if(!c.deleted())names.put(pair(c.customer(),c.name()),c);versions.put(c.id(),c.version());}
        var ids=projects.stream().map(Project::getId).toList();Map<Long,Set<String>> existingProgress=new HashMap<>();Map<Long,List<Owned>> owned=new HashMap<>();
        if(!ids.isEmpty()){
            for(var log:progress.findActiveByProjectIds(ids))existingProgress.computeIfAbsent(log.getProject().getId(),key->new HashSet<>()).add(progressKey(log.getLogDate(),log.getContent()));
            for(var product:products.findAllByProjectIdIn(ids))owned.computeIfAbsent(product.getProject().getId(),key->new ArrayList<>()).add(new Owned(product.getId(),product.getProductCode()));
        }
        ImportReferenceScope.put("batch-lookups",new Snapshot(external,names,versions,existingProgress,owned));
    }
    private String text(Map<String,Object> fields,String camel,String snake){Object value=fields.containsKey(camel)?fields.get(camel):fields.get(snake);return value==null?"":String.valueOf(value).trim();}
    public static Snapshot current(){return ImportReferenceScope.get("batch-lookups");}
    public static boolean fresh(Project project){var snapshot=current();return snapshot!=null&&Objects.equals(snapshot.versions().get(project.getId()),project.getRowVersion());}
}
