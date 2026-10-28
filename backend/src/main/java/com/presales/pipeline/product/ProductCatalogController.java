package com.presales.pipeline.product;
import com.presales.pipeline.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import java.util.List;
@RestController @RequestMapping("/api/config/products")
public class ProductCatalogController {
    private final ProductCatalog catalog;
    public ProductCatalogController(ProductCatalog catalog){this.catalog=catalog;}
    @GetMapping public ApiResponse<List<ProductDefinition>> list(){return ApiResponse.success(catalog.list());}
    @PostMapping public ApiResponse<ProductDefinition> create(@Valid @RequestBody ProductCatalog.Input input){return ApiResponse.success(catalog.save(null,input));}
    @PutMapping("/{id}") public ApiResponse<ProductDefinition> update(@PathVariable Long id,@Valid @RequestBody ProductCatalog.Input input){return ApiResponse.success(catalog.save(id,input));}
}
