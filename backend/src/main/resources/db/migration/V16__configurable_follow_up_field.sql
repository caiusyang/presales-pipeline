ALTER TABLE follow_up_policies
 ADD COLUMN field_key VARCHAR(80) NOT NULL DEFAULT 'fixedTarget',
 ADD COLUMN default_days INT NOT NULL DEFAULT 14,
 ADD COLUMN value_rules JSON NULL;
UPDATE follow_up_policies SET default_days=normal_days,
 value_rules=JSON_ARRAY(JSON_OBJECT('value','true','days',fixed_target_days),JSON_OBJECT('value','false','days',normal_days));
