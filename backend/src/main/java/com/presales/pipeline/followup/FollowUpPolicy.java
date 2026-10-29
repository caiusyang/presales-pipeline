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
    @Column(name="updated_at", nullable=false)
    public LocalDateTime updatedAt;
}
