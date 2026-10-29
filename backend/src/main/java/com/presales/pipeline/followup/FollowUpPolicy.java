package com.presales.pipeline.followup;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="follow_up_policies")
public class FollowUpPolicy {
    @Id
    public Long id = 1L;
    @Column(name="fixed_target_days", nullable=false)
    public int fixedTargetDays = 7;
    @Column(name="normal_days", nullable=false)
    public int normalDays = 14;
    @Column(name="field_key", nullable=false, length=80)
    public String fieldKey = "fixedTarget";
    @Column(name="default_days", nullable=false)
    public int defaultDays = 14;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name="value_rules", columnDefinition="json")
    public java.util.List<FollowUpPolicyService.Rule> valueRules = java.util.List.of(new FollowUpPolicyService.Rule("true",7),new FollowUpPolicyService.Rule("false",14));
    @Column(name="updated_at", nullable=false)
    public LocalDateTime updatedAt;
}
