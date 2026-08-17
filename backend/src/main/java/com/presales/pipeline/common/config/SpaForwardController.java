package com.presales.pipeline.common.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 前端构建产物放入 classpath:/static 后，将无扩展名的前端路由交给 index.html。
 * API、健康检查和静态资源文件不经过此控制器。
 */
@Controller
public class SpaForwardController {

    @GetMapping({
            "/",
            "/{path:^(?!api|actuator|error)[^.]+}",
            "/{path:^(?!api|actuator|error)[^.]+}/**"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
