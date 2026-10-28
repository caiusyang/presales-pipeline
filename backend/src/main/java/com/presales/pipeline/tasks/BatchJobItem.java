package com.presales.pipeline.tasks;

import jakarta.persistence.*;

@Entity @Table(name="batch_job_items",uniqueConstraints=@UniqueConstraint(columnNames={"job_id","item_index"}))
public class BatchJobItem {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Column(name="job_id",nullable=false) public String jobId;
    @Column(name="item_index",nullable=false) public int itemIndex;
    public int weight=1;
    @Column(nullable=false,length=32) public String status="PENDING";
    @Column(name="input_data",nullable=false,columnDefinition="longtext") public String inputData;
    @Column(name="result_data",columnDefinition="longtext") public String resultData;
    @Column(columnDefinition="text") public String error;
}
