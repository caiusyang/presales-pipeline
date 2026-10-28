package com.presales.pipeline.people;
import com.presales.pipeline.common.model.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.*;
@Entity @Table(name="responsible_people") @org.hibernate.annotations.BatchSize(size=100)
public class Person extends BaseEntity {
    @Column(nullable=false) public String name;
    @Column(name="employee_no",unique=true,length=128) public String employeeNo;
    @Column(unique=true,length=128) public String account;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="json") public List<String> aliases=new ArrayList<>();
    @Column(nullable=false) public boolean enabled=true;
    public String getName(){return name;}
    public String getEmployeeNo(){return employeeNo;}
    public String getAccount(){return account;}
    public boolean isEnabled(){return enabled;}
    public java.util.List<String> getAliases(){return aliases;}
    public void setName(String value){name=value;}
    public void setEmployeeNo(String value){employeeNo=value;}
    public void setAccount(String value){account=value;}
    public void setAliases(java.util.List<String> value){aliases=value;}
    public void setEnabled(boolean value){enabled=value;}
}
