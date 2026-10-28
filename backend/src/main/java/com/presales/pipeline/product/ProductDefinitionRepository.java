package com.presales.pipeline.product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ProductDefinitionRepository extends JpaRepository<ProductDefinition,Long> {
    List<ProductDefinition> findAllByOrderBySortOrderAscIdAsc();
}
