package com.presales.pipeline.product;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.importing.ImportReferenceScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.core.annotation.Order;
import jakarta.validation.constraints.*;
import java.util.*;

/** 编码稳定，名称和识别别名由目录维护；停用不删除历史引用。 */
@Service @Order(-20)
public class ProductCatalog implements ApplicationRunner {
    public static final String EXPORT_FIELD_PREFIX="product.";
    public static final List<String> CODES=List.of("AAD","WAF","CFW","ESA","HSS","NDR","DEW","DSC","SecMaster","DBSS","CBH","安全运营专业服务","大模型防火墙","智能体卫士");
    private final ProductDefinitionRepository repository;
    public ProductCatalog(ProductDefinitionRepository repository){this.repository=repository;}
    @Override @Transactional public void run(ApplicationArguments arguments){
        var existing=repository.findAll();
        for(int i=0;i<CODES.size();i++){
            String code=CODES.get(i);if(existing.stream().anyMatch(p->p.code.equalsIgnoreCase(code)))continue;
            ProductDefinition p=new ProductDefinition();p.code=code;p.name=code;p.sortOrder=i*10;
            p.aliases=switch(code){case "AAD"->new ArrayList<>(List.of("DDoS","Anti-DDoS"));case "SecMaster"->new ArrayList<>(List.of("安全云脑"));case "ESA"->new ArrayList<>(List.of("边缘安全ESA"));case "DSC"->new ArrayList<>(List.of("数据分类分级"));default->new ArrayList<>();};
            repository.save(p);
        }
    }
    @Transactional(readOnly=true) public List<ProductDefinition> list(){return ImportReferenceScope.cached("product-catalog",repository::findAllByOrderBySortOrderAscIdAsc);}
    public List<String> codes(){return list().stream().map(p->p.code).toList();}
    public String name(String code){return list().stream().filter(p->p.code.equals(code)).map(p->p.name).findFirst().orElse(code);}
    public String normalize(String value){
        if(value==null||value.isBlank())return null;
        return list().stream().filter(p->tokens(p).stream().anyMatch(token->token.equalsIgnoreCase(value.trim()))).map(p->p.code).findFirst().orElseThrow(()->BusinessException.badRequest("产品不在目录中："+value));
    }
    public List<String> normalizeAll(List<String> values){
        Set<String> wanted=new LinkedHashSet<>();if(values!=null)for(String value:values){String code=normalize(value);if(code!=null)wanted.add(code);}
        return codes().stream().filter(wanted::contains).toList();
    }
    public void validateSelections(List<String> values,List<String> previous,String track){
        for(String code:normalizeAll(values)){
            if(previous!=null&&previous.contains(code))continue;
            ProductDefinition p=list().stream().filter(item->item.code.equals(code)).findFirst().orElseThrow();
            if(!p.enabled)throw BusinessException.badRequest("产品已停用，不能新增选择："+p.name);
            if(!p.applicableTracks.isEmpty()&&!p.applicableTracks.contains(track))throw BusinessException.badRequest("产品不适用当前赛道："+p.name);
        }
    }
    public record Input(@NotBlank @Size(max=64) String code,@NotBlank @Size(max=255) String name,List<@NotBlank @Size(max=255) String> aliases,List<String> applicableTracks,int sortOrder,boolean enabled){}
    @Transactional public ProductDefinition save(Long id,Input input){
        ProductDefinition p=id==null?new ProductDefinition():repository.findById(id).orElseThrow(()->BusinessException.notFound("产品不存在"));
        String code=input.code().trim();if(id!=null&&!p.code.equals(code))throw BusinessException.conflict("产品编码创建后不可修改");
        if(code.contains(".")||code.contains(":")||code.contains("/")||code.contains(",")||code.contains("、"))throw BusinessException.badRequest("产品编码不能包含分隔符 . : / , 、");
        var tracks=input.applicableTracks()==null?List.<String>of():input.applicableTracks().stream().distinct().toList();
        if(tracks.stream().anyMatch(t->!List.of("HCS","公有云").contains(t)))throw BusinessException.badRequest("适用赛道只能是 HCS、公有云");
        var aliases=input.aliases()==null?List.<String>of():input.aliases().stream().map(String::trim).distinct().toList();
        Set<String> identifiers=new HashSet<>();identifiers.add(code.toLowerCase(Locale.ROOT));identifiers.add(input.name().trim().toLowerCase(Locale.ROOT));aliases.forEach(a->identifiers.add(a.toLowerCase(Locale.ROOT)));
        for(var other:repository.findAll())if(!Objects.equals(other.getId(),id)&&tokens(other).stream().map(t->t.toLowerCase(Locale.ROOT)).anyMatch(identifiers::contains))throw BusinessException.conflict("产品编码、名称或别名与其他产品冲突："+other.name);
        p.code=code;p.name=input.name().trim();p.aliases=new ArrayList<>(aliases);p.applicableTracks=new ArrayList<>(tracks);p.sortOrder=input.sortOrder();p.enabled=input.enabled();
        var saved=repository.saveAndFlush(p);ImportReferenceScope.clear();return saved;
    }
    private List<String> tokens(ProductDefinition p){List<String> values=new ArrayList<>(p.aliases);values.add(p.code);values.add(p.name);return values;}
    public static String exportFieldKey(String code){return EXPORT_FIELD_PREFIX+code;}
    public String exportCode(String field){return field!=null&&field.startsWith(EXPORT_FIELD_PREFIX)&&codes().contains(field.substring(EXPORT_FIELD_PREFIX.length()))?field.substring(EXPORT_FIELD_PREFIX.length()):null;}
}
