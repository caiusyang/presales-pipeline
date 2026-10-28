package com.presales.pipeline.product;
import com.presales.pipeline.common.model.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.*;
@Entity @Table(name="product_catalog")
public class ProductDefinition extends BaseEntity {
    @Column(nullable=false,unique=true,length=64) public String code;
    @Column(nullable=false) public String name;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="json") public List<String> aliases=new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="applicable_tracks",nullable=false,columnDefinition="json") public List<String> applicableTracks=new ArrayList<>();
    @Column(name="sort_order",nullable=false) public int sortOrder;
    @Column(nullable=false) public boolean enabled=true;
}
