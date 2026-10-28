package com.presales.pipeline.importing;
import org.springframework.stereotype.Service;

@Service
public class ImportReferenceCache {
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    public void refresh(){
        // Recheck configuration before each isolated write; mutations invalidate chunk snapshots.
        String revision=String.valueOf(entityManager.createNativeQuery("select concat(coalesce(concat('',(select max(updated_at) from dictionaries)),'none'),'/',coalesce(concat('',(select max(updated_at) from custom_field_definitions)),'none'),'/',coalesce(concat('',(select max(updated_at) from dictionary_categories)),'none'),'/',coalesce(concat('',(select max(updated_at) from product_catalog)),'none'))").getSingleResult());
        ImportReferenceScope.revision(revision);
    }
}
