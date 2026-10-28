package com.presales.pipeline.tasks;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name="batch_jobs")
public class BatchJob {
    @Id public String id;
    @Column(name="request_key",nullable=false,unique=true,length=128) public String requestKey;
    @Column(name="payload_hash",nullable=false,length=64) public String payloadHash;
    @Column(nullable=false,length=32) public String kind;
    @Column(nullable=false,length=32) public String status;
    @Column(nullable=false,columnDefinition="longtext") public String payload;
    @Column(nullable=false) public String operator;
    public int total, processed, succeeded, failed;
    @Column(columnDefinition="text") public String error;
    @Column(name="retry_key",length=128) public String retryKey;
    @Column(name="created_at",nullable=false) public LocalDateTime createdAt;
    @Column(name="updated_at",nullable=false) public LocalDateTime updatedAt;
}
