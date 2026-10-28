CREATE TABLE purged_project_snapshots (
 project_id BIGINT NOT NULL PRIMARY KEY,identity_hashes JSON NOT NULL,progress_ids JSON NOT NULL,
 purged_at DATETIME(6) NOT NULL,KEY idx_purged_snapshot_time (purged_at)
);
-- No project FK: deletion tombstones contain only hashes / technical IDs, so old jobs cannot resurrect deleted business data.
