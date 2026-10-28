package com.presales.pipeline.solution;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.dictionary.*;
import com.presales.pipeline.importing.ImportReferenceScope;
import com.presales.pipeline.project.Project;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class ProjectSolutions {
    private final DictionaryRepository dictionaries;
    public ProjectSolutions(DictionaryRepository dictionaries){this.dictionaries=dictionaries;}
    private List<DictionaryItem> all(){return ImportReferenceScope.cached("solution-dictionaries",dictionaries::findAllByDeletedFalseOrderByTypeAscSortOrderAscIdAsc);}
    public List<SolutionSelection> normalize(List<SolutionSelection> incoming,String legacySolution,String legacySub){
        if(incoming==null&&(legacySolution==null||legacySolution.isBlank())&&legacySub!=null&&!legacySub.isBlank())throw BusinessException.badRequest("细分解决方案缺少上级解决方案");
        if(incoming==null)incoming=legacySolution==null||legacySolution.isBlank()?List.of():List.of(new SolutionSelection(legacySolution,legacySub==null||legacySub.isBlank()?List.of():List.of(legacySub)));
        if(incoming.size()>100)throw BusinessException.badRequest("最多关联100组解决方案");
        Map<String,LinkedHashSet<String>> grouped=new TreeMap<>();
        for(var entry:incoming){
            if(entry==null||entry.solution()==null||entry.solution().isBlank()||entry.subSolutions()==null)throw BusinessException.badRequest("方案集合格式不正确");
            var parent=parent(entry.solution());var children=grouped.computeIfAbsent(parent.getValue(),key->new LinkedHashSet<>());
            if(entry.subSolutions().size()>100)throw BusinessException.badRequest("每个方案最多关联100个细分方案");
            for(String sub:entry.subSolutions())children.add(child(parent,sub).getValue());
        }
        return grouped.entrySet().stream().map(e->new SolutionSelection(e.getKey(),e.getValue().stream().sorted().toList())).toList();
    }
    private DictionaryItem parent(String value){var matches=all().stream().filter(d->d.getType().equals("solution")&&d.getValue().equalsIgnoreCase(value.trim())).toList();if(matches.size()!=1)throw BusinessException.badRequest("无效或存在歧义的解决方案："+value);return matches.get(0);}
    private DictionaryItem child(DictionaryItem parent,String value){var matches=all().stream().filter(d->d.getType().equals("sub_solution")&&d.getParent()!=null&&d.getParent().getId().equals(parent.getId())&&value!=null&&d.getValue().equalsIgnoreCase(value.trim())).toList();if(matches.size()!=1)throw BusinessException.badRequest("细分解决方案不属于所选解决方案或存在歧义："+value);return matches.get(0);}
    public void sync(Project project,List<SolutionSelection> selections){
        Map<String,ProjectSolution> wanted=new LinkedHashMap<>();
        for(var selection:selections){var parent=parent(selection.solution());if(selection.subSolutions().isEmpty()){var link=new ProjectSolution();link.project=project;link.solution=parent;wanted.put(parent.getId()+":",link);}else for(String sub:selection.subSolutions()){var link=new ProjectSolution();link.project=project;link.solution=parent;link.subSolution=child(parent,sub);wanted.put(parent.getId()+":"+link.subSolution.getId(),link);}}
        var links=project.solutionLinks();
        links.removeIf(link->!wanted.containsKey(link.solution.getId()+":"+(link.subSolution==null?"":link.subSolution.getId())));
        for(var entry:wanted.entrySet())if(links.stream().noneMatch(link->(link.solution.getId()+":"+(link.subSolution==null?"":link.subSolution.getId())).equals(entry.getKey())))links.add(entry.getValue());
    }
}
