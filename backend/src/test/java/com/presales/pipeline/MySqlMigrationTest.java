package com.presales.pipeline;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
/** Opt-in, empty disposable database only. This test never drops or cleans an existing database. */
@EnabledIfEnvironmentVariable(named="MYSQL_MIGRATION_TEST",matches="true")
class MySqlMigrationTest {
    @Test void migratePreviousReleaseWithRelationsAndRetainUncertainValues()throws Exception{
        String url=System.getenv().getOrDefault("MYSQL_MIGRATION_URL","jdbc:mysql://127.0.0.1:3306/presales_migration_test?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai");
        assertTrue(url.contains("/presales_migration_test"),"只能使用专用可丢弃测试库");
        String username=System.getenv().getOrDefault("MYSQL_MIGRATION_USER","root"),password=System.getenv("MYSQL_MIGRATION_PASSWORD");
        try(var connection=DriverManager.getConnection(url,username,password);var statement=connection.createStatement()){
            try(var result=statement.executeQuery("select count(*) from information_schema.tables where table_schema=database()")){result.next();assertEquals(0,result.getInt(1),"测试库必须为空，不会清除现有数据");}
        }
        Flyway.configure().dataSource(url,username,password).locations("classpath:db/migration").target("6").load().migrate();
        try(var connection=DriverManager.getConnection(url,username,password);var statement=connection.createStatement()){
            statement.executeUpdate("insert into projects(id,customer_name,project_name,solution,track,custom_fields,purchased_products,deleted,created_at,updated_at,security_budget,project_status) values (90001,'迁移客户','可匹配方案','安全咨询','数据安全',JSON_OBJECT(),JSON_ARRAY('WAF'),false,'2025-01-01','2025-01-01',10.50,'方案设计'),(90002,'迁移客户','未知方案','无法匹配原文','云安全',JSON_OBJECT(),JSON_ARRAY(),false,'2025-01-01','2025-01-01',null,'机会点识别')");
            statement.executeUpdate("insert into revenues(project_id,revenue_month,amount,deleted,created_at,updated_at) values(90001,'2025-01',123.45,false,'2025-02-01','2025-02-01')");
            statement.executeUpdate("insert into project_products(project_id,product_code,created_at,updated_at) values(90001,'WAF','2025-01-01','2025-01-01')");
        }
        Flyway.configure().dataSource(url,username,password).locations("classpath:db/migration").target("15").load().migrate();
        try(var connection=DriverManager.getConnection(url,username,password);var statement=connection.createStatement()) {
            statement.executeUpdate("update follow_up_policies set fixed_target_days=9,normal_days=18 where id=1");
        }
        var flyway=Flyway.configure().dataSource(url,username,password).locations("classpath:db/migration").load();flyway.migrate();flyway.validate();
        try(var connection=DriverManager.getConnection(url,username,password);var statement=connection.createStatement();var result=statement.executeQuery("select field_key,default_days,value_rules from follow_up_policies where id=1")) {
            result.next();assertEquals("fixedTarget",result.getString(1));assertEquals(18,result.getInt(2));
            var rules=new com.fasterxml.jackson.databind.ObjectMapper().readTree(result.getString(3));assertEquals(9,rules.get(0).path("days").asInt());assertEquals(18,rules.get(1).path("days").asInt());
        }
        // Validate the real Hibernate/MySQL schema and run ordered catalog/mapping initializers, not just Flyway SQL.
        try(var context=new org.springframework.boot.builder.SpringApplicationBuilder(PresalesPipelineApplication.class).run(
                "--server.port=0","--spring.datasource.url="+url,"--spring.datasource.username="+username,"--spring.datasource.password="+password,
                "--spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver","--spring.jpa.hibernate.ddl-auto=validate","--spring.flyway.enabled=true")){
            assertTrue(context.getBean(com.presales.pipeline.product.ProductCatalog.class).codes().contains("WAF"));
            var backup=context.getBean(com.presales.pipeline.backup.BackupService.class).exportAll();
            assertEquals(2,backup.tables().get("projects").size());assertTrue(backup.tables().containsKey("purged_project_snapshots"));
            assertEquals(1,backup.tables().get("follow_up_policies").size());
            context.getBean(com.presales.pipeline.config.ConfigService.class).createCustomField(new com.presales.pipeline.config.dto.CustomFieldRequest("follow_tag","跟进标签","text",false,java.util.List.of(),999));
            try(var connection=DriverManager.getConnection(url,username,password);var statement=connection.createStatement()) { statement.executeUpdate("update projects set custom_fields=JSON_OBJECT('follow_tag','VIP') where id=90001"); }
            var follow=context.getBean(com.presales.pipeline.followup.FollowUpPolicyService.class);
            follow.save(new com.presales.pipeline.followup.FollowUpPolicyService.Policy(null,null,"custom.follow_tag",3650,java.util.List.of(new com.presales.pipeline.followup.FollowUpPolicyService.Rule("vip",1)),null,null));
            var due=context.getBean(com.presales.pipeline.project.ProjectService.class).list(null,null,null,null,null,null,0,1,"id","asc",false,null,null,null,null,null,"due",null,null);
            assertEquals(1,due.totalElements());assertEquals(90001L,due.items().get(0).id());
        }
        try(var connection=DriverManager.getConnection(url,username,password);var statement=connection.createStatement()){
            try(var r=statement.executeQuery("select count(*),sum(security_budget) from projects")){r.next();assertEquals(2,r.getInt(1));assertEquals("10.50",r.getBigDecimal(2).toPlainString());}
            try(var r=statement.executeQuery("select track,security_direction,last_follow_up_at from projects where id=90001")){r.next();assertNull(r.getString(1));assertEquals("数据安全",r.getString(2));assertTrue(r.getString(3).startsWith("2025-02-01"));}
            try(var r=statement.executeQuery("select count(*) from project_solutions where project_id=90001")){r.next();assertEquals(1,r.getInt(1));}
            try(var r=statement.executeQuery("select count(*) from migration_issues where project_id=90002 and area='solutions' and original_value like '%无法匹配原文%'")){r.next();assertEquals(1,r.getInt(1));}
            try(var r=statement.executeQuery("select count(*),sum(amount) from revenues")){r.next();assertEquals(1,r.getInt(1));assertEquals("123.45",r.getBigDecimal(2).toPlainString());}
            try(var r=statement.executeQuery("select count(*) from project_products")){r.next();assertEquals(1,r.getInt(1));}
            try(var r=statement.executeQuery("select fixed_target,project_level,last_follow_up_at from projects where id=90001")){r.next();assertFalse(r.getBoolean(1));assertNull(r.getString(2));assertTrue(r.getString(3).startsWith("2025-02-01"));}
            try(var r=statement.executeQuery("select fixed_target_days,normal_days from follow_up_policies where id=1")){r.next();assertEquals(9,r.getInt(1));assertEquals(18,r.getInt(2));}
        }
    }
}
