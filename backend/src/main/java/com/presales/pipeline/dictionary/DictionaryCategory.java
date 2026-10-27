package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "dictionary_categories")
public class DictionaryCategory extends SoftDeletableEntity {
    @Column(nullable = false, unique = true, length = 64)
    private String type;
    @Column(nullable = false)
    private String label;
    @Column(name = "built_in", nullable = false)
    private boolean builtIn;
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public boolean isBuiltIn() { return builtIn; }
    public void setBuiltIn(boolean builtIn) { this.builtIn = builtIn; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
