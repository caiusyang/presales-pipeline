package com.presales.pipeline.config;
import com.presales.pipeline.config.dto.ImportMappingRequest;
import org.springframework.boot.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Component @Order(30)
public class StandardMappingInitializer implements ApplicationRunner {
    private final ConfigService config;
    public StandardMappingInitializer(ConfigService config){this.config=config;}
    @Override @Transactional public void run(ApplicationArguments args){
        String name="公有云需求洞察（固定语义）";
        if(config.listImportMappings().stream().anyMatch(m->m.name().equals(name)))return;
        Map<String,Object> columns=new LinkedHashMap<>();
        columns.put("客户名称","customerName");columns.put("行业","industry");columns.put("业务场景","scenario");columns.put("安全关键需求","keyNeeds");columns.put("当前进展","progressText");columns.put("安全解决方案类型","solution");columns.put("项目风险和求助","keyRisks");
        String[][] custom={{"区域","region","text"},{"代表处","office","text"},{"是否云重点客户","key_cloud_customer","text"},{"项目属性","project_attribute","text"},{"是否标杆","benchmark_customer","text"},{"云空间(万/月)","cloud_space_monthly","number"},{"26年新增安全机会","security_opportunity_2026","text"},{"26年新增安全空间(万/月)","security_space_monthly_2026","number"},{"预计下单时间","expected_order_date","date"},{"一线SA","frontline_sa","text"},{"备注","source_note","text"}};
        for(var field:custom)columns.put(field[0],"__new_custom__:"+field[2]+":"+field[1]+":"+java.net.URLEncoder.encode(field[0],java.nio.charset.StandardCharsets.UTF_8).replace("+","%20"));
        // 需求洞察内的产品列不列为已购；其余列由导入界面按原文补充为需求字段。
        config.createImportMapping(new ImportMappingRequest(name,columns,List.of(Map.of("type","default","field","track","value","公有云")),"公有云"));
    }
}
