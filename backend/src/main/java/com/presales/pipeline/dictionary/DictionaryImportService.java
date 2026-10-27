package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.dictionary.dto.DictionaryImportRequest;
import com.presales.pipeline.dictionary.dto.DictionaryImportResponse;
import com.presales.pipeline.dictionary.dto.DictionaryRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Each create uses DictionaryService's own transaction; a rejected row does not roll back successful rows. */
@Service
public class DictionaryImportService {
    private final DictionaryService dictionaries;
    private final DictionaryRepository repository;
    public DictionaryImportService(DictionaryService dictionaries, DictionaryRepository repository) {
        this.dictionaries = dictionaries; this.repository = repository;
    }

    public DictionaryImportResponse execute(DictionaryImportRequest request) {
        List<DictionaryImportResponse.Detail> details = new ArrayList<>();
        Map<String, Long> seen = new HashMap<>();
        int added = 0, skipped = 0, failed = 0;
        int sortOrder = repository.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(request.type()).stream()
                .mapToInt(DictionaryItem::getSortOrder).max().orElse(0);
        for (int i = 0; i < request.records().size(); i++) {
            var row = request.records().get(i);
            int sourceRow = row == null || row.sourceRow() == null ? i + 1 : row.sourceRow();
            String value = row == null || row.value() == null ? "" : row.value().trim();
            try {
                if (sourceRow < 1) throw BusinessException.badRequest("来源行号必须为正整数");
                var payload = new DictionaryRequest(request.type(), value, request.parentId(), sortOrder + 10);
                var preview = dictionaries.preview(payload);
                value = preview.value();
                String key = value.toLowerCase(Locale.ROOT);
                Long existingId = dictionaries.existingId(request.type(), value, request.parentId());
                if (existingId != null || seen.containsKey(key)) {
                    skipped++;
                    details.add(new DictionaryImportResponse.Detail(sourceRow, value, "skipped",
                            existingId != null ? "该字典值已存在" : "与本次导入前面的字典值重复", existingId != null ? existingId : seen.get(key)));
                    continue;
                }
                Long id = request.dryRun() ? null : dictionaries.create(payload).id();
                seen.put(key, id);
                sortOrder += 10;
                added++;
                details.add(new DictionaryImportResponse.Detail(sourceRow, value, "added", null, id));
            } catch (BusinessException exception) {
                failed++;
                details.add(new DictionaryImportResponse.Detail(sourceRow, value, "failed", exception.getMessage(), null));
            } catch (DataIntegrityViolationException exception) {
                failed++;
                details.add(new DictionaryImportResponse.Detail(sourceRow, value, "failed", "该行与现有字典数据冲突，请重新预检", null));
            }
        }
        return new DictionaryImportResponse(request.dryRun(), added, skipped, failed, details);
    }
}
