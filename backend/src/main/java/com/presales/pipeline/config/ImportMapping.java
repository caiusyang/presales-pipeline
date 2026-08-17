package com.presales.pipeline.config;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "import_mappings")
public class ImportMapping extends SoftDeletableEntity {

    @Column(nullable = false)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_map", nullable = false, columnDefinition = "json")
    private Map<String, Object> columnMap = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "value_rules", nullable = false, columnDefinition = "json")
    private List<Map<String, Object>> valueRules = new ArrayList<>();

    protected ImportMapping() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Map<String, Object> getColumnMap() {
        return columnMap;
    }

    public void setColumnMap(Map<String, Object> columnMap) {
        this.columnMap = columnMap == null ? new LinkedHashMap<>() : new LinkedHashMap<>(columnMap);
    }

    public List<Map<String, Object>> getValueRules() {
        return valueRules;
    }

    public void setValueRules(List<Map<String, Object>> valueRules) {
        this.valueRules = valueRules == null ? new ArrayList<>() : new ArrayList<>(valueRules);
    }
}
