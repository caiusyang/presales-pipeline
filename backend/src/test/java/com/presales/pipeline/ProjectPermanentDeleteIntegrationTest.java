package com.presales.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.presales.pipeline.product.ProjectProduct;
import com.presales.pipeline.product.ProjectProductRepository;
import com.presales.pipeline.progress.ProgressLog;
import com.presales.pipeline.progress.ProgressLogRepository;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.revenue.Revenue;
import com.presales.pipeline.revenue.RevenueRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class ProjectPermanentDeleteIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProjectRepository projects;
    @Autowired RevenueRepository revenues;
    @Autowired ProgressLogRepository progress;
    @Autowired ProjectProductRepository products;
    @Autowired JdbcTemplate jdbc;

    private static final List<String> CHILD_TABLES = List.of("revenues", "progress_logs", "project_products", "change_logs");

    @Test
    @WithMockUser(roles = "ADMIN")
    void permanentlyDeletesAllChildRowsIncludingSoftDeletedRowsAndLeavesOtherProjectsIntact() throws Exception {
        long id = createProjectWithChildren("PURGE-001");
        long otherId = createProjectWithChildren("PURGE-002");
        mvc.perform(delete("/api/projects/{id}", id).with(csrf())).andExpect(status().isOk());
        assertTrue(projects.findById(id).orElseThrow().isDeleted());
        assertEquals(2, count("revenues", id));
        assertEquals(2, count("progress_logs", id));
        assertEquals(1, count("project_products", id));
        assertTrue(count("change_logs", id) > 0);

        mvc.perform(delete("/api/projects/{id}/permanent", id).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(0));
        assertFalse(projects.existsById(id));
        CHILD_TABLES.forEach(table -> assertEquals(0, count(table, id), table));
        assertTrue(projects.existsById(otherId));
        assertFalse(projects.findById(otherId).orElseThrow().isDeleted());
        assertEquals(2, count("revenues", otherId));
        assertEquals(2, count("progress_logs", otherId));
        assertEquals(1, count("project_products", otherId));
        assertTrue(count("change_logs", otherId) > 0);
        mvc.perform(post("/api/projects/{id}/restore", id).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(get("/api/projects/{id}/detail", id)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/projects/{id}/permanent", id).with(csrf())).andExpect(status().isNotFound());
        assertNotEquals(id, createProjectWithChildren("PURGE-001"), "外部编号在硬删除后可以重新使用");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsActiveAndRestoredProjectsBeforeDeletingAnyChildData() throws Exception {
        long id = createProjectWithChildren("PURGE-GUARD");
        mvc.perform(delete("/api/projects/{id}/permanent", id).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("仅允许永久删除回收站中的项目，请先移入回收站"));
        assertFalse(projects.findById(id).orElseThrow().isDeleted());
        assertEquals(2, count("revenues", id));
        assertEquals(2, count("progress_logs", id));
        assertEquals(1, count("project_products", id));
        mvc.perform(delete("/api/projects/{id}", id).with(csrf())).andExpect(status().isOk());
        mvc.perform(post("/api/projects/{id}/restore", id).with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/projects/{id}/permanent", id).with(csrf())).andExpect(status().isConflict());
        assertEquals(2, count("revenues", id));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void deletionFailureRollsBackChildCleanupAndKeepsProjectRestorable() throws Exception {
        long id = createProjectWithChildren("PURGE-ROLLBACK");
        mvc.perform(delete("/api/projects/{id}", id).with(csrf())).andExpect(status().isOk());
        int logsBefore = count("change_logs", id);
        // 模拟未来新增关联表阻止主表删除，验证前面的子表清理也会回滚。
        jdbc.execute("create table purge_test_blocker (project_id bigint not null references projects(id))");
        try {
            jdbc.update("insert into purge_test_blocker(project_id) values (?)", id);
            mvc.perform(delete("/api/projects/{id}/permanent", id).with(csrf())).andExpect(status().isConflict());
            assertTrue(projects.findById(id).orElseThrow().isDeleted());
            assertEquals(2, count("revenues", id));
            assertEquals(2, count("progress_logs", id));
            assertEquals(1, count("project_products", id));
            assertEquals(logsBefore, count("change_logs", id));
        } finally {
            jdbc.execute("drop table purge_test_blocker");
        }
        mvc.perform(post("/api/projects/{id}/restore", id).with(csrf())).andExpect(status().isOk());
    }

    @Test
    void permanentDeleteStillRequiresLoginAndCsrf() throws Exception {
        mvc.perform(delete("/api/projects/1/permanent").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/projects/1/permanent").with(user("test-admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
    }

    private long createProjectWithChildren(String externalId) throws Exception {
        var response = mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalId":"%s","customerName":"清理测试客户","projectName":"%s","customFields":{}}
                        """.formatted(externalId, externalId)))
                .andExpect(status().isOk()).andReturn();
        long id = mapper.readTree(response.getResponse().getContentAsByteArray()).path("data").path("id").asLong();
        Project project = projects.findById(id).orElseThrow();
        revenues.save(new Revenue(project, "2026-10", BigDecimal.TEN));
        Revenue removedRevenue = new Revenue(project, "2026-09", BigDecimal.ONE);
        removedRevenue.setDeleted(true);
        revenues.save(removedRevenue);
        progress.save(new ProgressLog(project, LocalDate.of(2026, 10, 27), "保留进展"));
        ProgressLog removedProgress = new ProgressLog(project, LocalDate.of(2026, 10, 26), "已删除进展");
        removedProgress.setDeleted(true);
        progress.save(removedProgress);
        products.save(new ProjectProduct(project, "WAF"));
        return id;
    }

    private int count(String table, long projectId) {
        if (!CHILD_TABLES.contains(table)) throw new IllegalArgumentException("未知表");
        return jdbc.queryForObject("select count(*) from " + table + " where project_id = ?", Integer.class, projectId);
    }
}
