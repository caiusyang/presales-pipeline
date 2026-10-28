package com.presales.pipeline.importing;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.ConfigService;
import com.presales.pipeline.importing.dto.ImportRecordRequest;
import com.presales.pipeline.importing.dto.ImportRecordResult;
import com.presales.pipeline.importing.dto.ImportRequest;
import com.presales.pipeline.importing.dto.ImportResponse;
import com.presales.pipeline.importing.dto.ImportIssue;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ImportService {

    private final ConfigService configService;
    private final ImportRecordProcessor processor;

    public ImportService(ConfigService configService, ImportRecordProcessor processor) {
        this.configService = configService;
        this.processor = processor;
    }

    public ImportResponse execute(ImportRequest request) {
        if (request.mappingId() != null) {
            configService.getImportMappingEntity(request.mappingId());
        }

        int added = 0;
        int overwritten = 0;
        int skipped = 0;
        List<ImportRecordResult> details = new ArrayList<>();
        Set<String> seenIdentifiers = new HashSet<>();

        for (int index = 0; index < request.records().size(); index++) {
            ImportRecordRequest record = request.records().get(index);
            int row = index + 1;
            String duplicateReason = checkBatchDuplicate(record.fields(), seenIdentifiers);
            if (duplicateReason != null) {
                skipped++;
                details.add(skipped(row, record, duplicateReason, List.of(new ImportIssue("_record", "duplicate", duplicateReason)), Map.of()));
                continue;
            }
            try {
                // 先预检再占用本批标识；同项目不同标识也按实际匹配结果判重。
                ImportRecordProcessor.ProcessedRecord result = processor.process(record, request.dryRun(), request.pendingFields(),seenIdentifiers);
                Set<String> resolved = new HashSet<>();
                if (result.projectId() != null) resolved.add("id:" + result.projectId());
                if (result.externalId() != null) resolved.add("ext:" + result.externalId().toLowerCase(Locale.ROOT));
                resolved.add("name:" + result.customerName().toLowerCase(Locale.ROOT) + "\u0000" + result.projectName().toLowerCase(Locale.ROOT));
                if (resolved.stream().anyMatch(seenIdentifiers::contains)) {
                    String reason = "同一导入批次中项目重复，仅处理首次通过校验的记录";
                    details.add(skipped(row, record, reason, List.of(new ImportIssue("_record", "duplicate", reason)), result.effectiveFields()));
                    skipped++;
                    continue;
                }
                seenIdentifiers.addAll(resolved);
                if (result.action() == ImportRecordProcessor.Action.ADDED) {
                    added++;
                } else {
                    overwritten++;
                }
                details.add(new ImportRecordResult(row, result.action().name().toLowerCase(Locale.ROOT),
                        result.projectId(), result.externalId(), result.customerName(), result.projectName(), null,
                        record.sourceRow(), List.of(), result.effectiveFields()));
            } catch (ImportValidationException exception) {
                skipped++;
                details.add(skipped(row, record, exception.getMessage(), exception.getIssues(), exception.getEffectiveFields()));
            } catch (BusinessException exception) {
                skipped++;
                details.add(skipped(row, record, exception.getMessage(), List.of(new ImportIssue("_record", "conflict", exception.getMessage())), Map.of()));
            } catch (org.springframework.dao.DataIntegrityViolationException exception) {
                skipped++;
                String reason = "数据约束冲突，请重新预检确认项目或字段是否已存在";
                details.add(skipped(row, record, reason, List.of(new ImportIssue("_record", "conflict", reason)), Map.of()));
            }
        }
        return new ImportResponse(request.dryRun(), request.mappingId(), added, overwritten, skipped, details);
    }

    private String checkBatchDuplicate(Map<String, Object> fields, Set<String> seen) {
        String externalId = string(fields, "externalId", "external_id");
        String customer = string(fields, "customerName", "customer_name");
        String project = string(fields, "projectName", "project_name");
        List<String> identifiers = new ArrayList<>();
        if (externalId != null) {
            identifiers.add("ext:" + externalId.toLowerCase(Locale.ROOT));
        }
        if (customer != null && project != null) {
            identifiers.add("name:" + customer.toLowerCase(Locale.ROOT) + "\u0000" + project.toLowerCase(Locale.ROOT));
        }
        if (identifiers.stream().anyMatch(seen::contains)) {
            return "同一导入批次中项目重复，仅处理首次通过校验的记录";
        }
        return null;
    }

    private ImportRecordResult skipped(int row, ImportRecordRequest record, String reason, List<ImportIssue> issues, Map<String, Object> effective) {
        Map<String, Object> fields = record.fields();
        return new ImportRecordResult(row, "skipped", null,
                string(fields, "externalId", "external_id"),
                string(fields, "customerName", "customer_name"),
                string(fields, "projectName", "project_name"), reason, record.sourceRow(), issues,
                effective.isEmpty() ? fields : effective);
    }

    private String string(Map<String, Object> fields, String camelKey, String snakeKey) {
        Object value = fields.containsKey(camelKey) ? fields.get(camelKey) : fields.get(snakeKey);
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return String.valueOf(value).trim();
    }
}
