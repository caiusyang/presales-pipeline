package com.presales.pipeline.importing;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.ConfigService;
import com.presales.pipeline.importing.dto.ImportRecordRequest;
import com.presales.pipeline.importing.dto.ImportRecordResult;
import com.presales.pipeline.importing.dto.ImportRequest;
import com.presales.pipeline.importing.dto.ImportResponse;
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
                details.add(skipped(row, record.fields(), duplicateReason));
                continue;
            }
            try {
                ImportRecordProcessor.ProcessedRecord result = processor.process(record, request.dryRun());
                if (result.action() == ImportRecordProcessor.Action.ADDED) {
                    added++;
                } else {
                    overwritten++;
                }
                details.add(new ImportRecordResult(row, result.action().name().toLowerCase(Locale.ROOT),
                        result.projectId(), result.externalId(), result.customerName(), result.projectName(), null));
            } catch (BusinessException exception) {
                skipped++;
                details.add(skipped(row, record.fields(), exception.getMessage()));
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
            identifiers.add("external:" + externalId.toLowerCase(Locale.ROOT));
        }
        if (customer != null && project != null) {
            identifiers.add("name:" + customer.toLowerCase(Locale.ROOT) + "\u0000" + project.toLowerCase(Locale.ROOT));
        }
        if (identifiers.stream().anyMatch(seen::contains)) {
            return "同一导入批次中项目重复，仅处理首次出现的记录";
        }
        seen.addAll(identifiers);
        return null;
    }

    private ImportRecordResult skipped(int row, Map<String, Object> fields, String reason) {
        return new ImportRecordResult(row, "skipped", null,
                string(fields, "externalId", "external_id"),
                string(fields, "customerName", "customer_name"),
                string(fields, "projectName", "project_name"), reason);
    }

    private String string(Map<String, Object> fields, String camelKey, String snakeKey) {
        Object value = fields.containsKey(camelKey) ? fields.get(camelKey) : fields.get(snakeKey);
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return String.valueOf(value).trim();
    }
}
