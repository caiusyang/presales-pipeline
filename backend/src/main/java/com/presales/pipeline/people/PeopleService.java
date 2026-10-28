package com.presales.pipeline.people;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.project.Project;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class PeopleService {
    private final PersonRepository repository;
    private final com.presales.pipeline.audit.ChangeLogService changes;
    public PeopleService(PersonRepository repository,com.presales.pipeline.audit.ChangeLogService changes){this.repository=repository;this.changes=changes;}
    public record Input(@NotBlank @Size(max=255) String name,@Size(max=128) String employeeNo,@Size(max=128) String account,@Size(max=100) List<@NotBlank @Size(max=255) String> aliases,boolean enabled){}
    public record Reference(String name,String employeeNo,String account,String role){}
    public record Match(List<Long> personIds,List<String> issues){}
    @Transactional(readOnly=true) public List<Person> list(){return repository.findAllByOrderByNameAscIdAsc();}
    @Transactional public Person save(Long id,Input input){
        var person=id==null?new Person():repository.findById(id).orElseThrow(()->BusinessException.notFound("责任人不存在"));
        String employee=clean(input.employeeNo()),account=clean(input.account());
        if(input.name()==null||input.name().isBlank()||input.name().trim().length()>255)throw BusinessException.badRequest("姓名不能为空且最多255字符");
        if(employee!=null&&employee.length()>128||account!=null&&account.length()>128)throw BusinessException.badRequest("工号和账号最多128字符");
        for(var other:repository.findAll())if(!Objects.equals(other.getId(),id)&&(employee!=null&&employee.equalsIgnoreCase(other.getEmployeeNo())||account!=null&&account.equalsIgnoreCase(other.getAccount())))throw BusinessException.conflict("工号或账号已被其他人员使用");
        var aliases=input.aliases()==null?List.<String>of():input.aliases().stream().map(String::trim).filter(s->!s.isEmpty()).distinct().toList();
        if(aliases.size()>100||aliases.stream().anyMatch(a->a.length()>255))throw BusinessException.badRequest("别名最多100个，每个最多255字符");
        person.setName(input.name().trim());person.setEmployeeNo(employee);person.setAccount(account);person.setAliases(new ArrayList<>(aliases));person.setEnabled(input.enabled());return repository.saveAndFlush(person);
    }
    @Transactional public Person importOne(Input input){
        List<Person> matches=repository.findAll().stream().filter(p->clean(input.employeeNo())!=null&&input.employeeNo().trim().equalsIgnoreCase(p.getEmployeeNo())||clean(input.account())!=null&&input.account().trim().equalsIgnoreCase(p.getAccount())).toList();
        if(matches.isEmpty()&&clean(input.employeeNo())==null&&clean(input.account())==null)matches=repository.findAll().stream().filter(p->p.getName().equals(input.name().trim())).toList();
        if(matches.size()>1)throw BusinessException.conflict("姓名或唯一标识存在歧义，请逐项确认后维护");
        return save(matches.isEmpty()?null:matches.get(0).getId(),input);
    }
    @Transactional(readOnly=true) public Match match(List<Reference> references){
        var people=list().stream().filter(Person::isEnabled).toList();Set<Long> hits=new LinkedHashSet<>();List<String> issues=new ArrayList<>();
        for(var ref:references){
            if(ref==null){issues.add("空人员记录");continue;}
            var matches=people.stream().filter(p->matches(p,ref)).toList();
            if(matches.size()==1)hits.add(matches.get(0).getId());else issues.add((matches.isEmpty()?"未命中：":"同名或标识歧义：")+String.valueOf(ref.name())+" / "+String.valueOf(ref.employeeNo())+" / "+String.valueOf(ref.account()));
        }
        return new Match(List.copyOf(hits),issues);
    }
    @Transactional public void syncManual(Project project,List<Long> ids){
        var wanted=ids==null?List.<Long>of():ids.stream().distinct().sorted().toList();if(wanted.size()>100)throw BusinessException.badRequest("最多关联100位责任人");
        for(Long id:wanted){var person=repository.findById(id).orElseThrow(()->BusinessException.badRequest("责任人不存在："+id));boolean previous=project.personLinks().stream().anyMatch(r->r.source.equals("manual")&&r.person.getId().equals(id));if(!person.isEnabled()&&!previous)throw BusinessException.badRequest("责任人已停用："+person.getName());}
        project.personLinks().removeIf(r->r.source.equals("manual")&&!wanted.contains(r.person.getId()));
        for(Long id:wanted)if(project.personLinks().stream().noneMatch(r->r.source.equals("manual")&&r.person.getId().equals(id))){var link=new ProjectPerson();link.project=project;link.person=repository.getReferenceById(id);link.source="manual";project.personLinks().add(link);}
    }
    /** Independent of the future transport adapter. Incomplete/ambiguous lists never clear old HCS links. */
    @Transactional public Match applyHcs(Project project,List<Reference> references,boolean complete){
        var before=project.getResponsibles();
        var result=match(references);var desired=result.personIds();
        if(complete&&result.issues().isEmpty())project.personLinks().removeIf(r->r.source.equals("hcs")&&!desired.contains(r.person.getId()));
        var people=list();
        for(Long id:desired){var link=project.personLinks().stream().filter(r->r.source.equals("hcs")&&r.person.getId().equals(id)).findFirst().orElse(null);if(link==null){link=new ProjectPerson();link.project=project;link.person=repository.getReferenceById(id);link.source="hcs";project.personLinks().add(link);}
            var person=people.stream().filter(p->p.getId().equals(id)).findFirst().orElseThrow();
            link.role=references.stream().filter(ref->matches(person,ref)).map(Reference::role).filter(Objects::nonNull).distinct().sorted().reduce((a,b)->a+"、"+b).orElse(null);
        }
        changes.logIfChanged(project,"responsibles",before,project.getResponsibles(),"hcs");
        return result;
    }
    public void validateManual(Project project,List<Long> ids){
        if(ids==null)return;if(ids.size()>100)throw BusinessException.badRequest("最多关联100位责任人");
        for(Long id:ids){var person=repository.findById(id).orElseThrow(()->BusinessException.badRequest("责任人不存在："+id));if(!person.isEnabled()&&(project==null||project.personLinks().stream().noneMatch(r->r.source.equals("manual")&&r.person.getId().equals(id))))throw BusinessException.badRequest("责任人已停用："+person.getName());}
    }
    private boolean matches(Person p,Reference ref){if(ref==null)return false;if(clean(ref.employeeNo())!=null||clean(ref.account())!=null)return clean(ref.employeeNo())!=null&&ref.employeeNo().trim().equalsIgnoreCase(p.getEmployeeNo())||clean(ref.account())!=null&&ref.account().trim().equalsIgnoreCase(p.getAccount());return clean(ref.name())!=null&&(p.getName().equals(ref.name().trim())||p.getAliases().contains(ref.name().trim()));}
    private String clean(String value){return value==null||value.isBlank()?null:value.trim();}
}
