package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "dictionaries")
public class DictionaryItem extends SoftDeletableEntity {

    @Column(nullable = false, length = 64)
    private String type;

    @Column(name = "item_value", nullable = false)
    private String value;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private DictionaryItem parent;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected DictionaryItem() {
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public DictionaryItem getParent() {
        return parent;
    }

    public void setParent(DictionaryItem parent) {
        this.parent = parent;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
