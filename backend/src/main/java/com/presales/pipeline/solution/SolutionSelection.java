package com.presales.pipeline.solution;
import jakarta.validation.constraints.*;
import java.util.List;
public record SolutionSelection(@NotBlank @Size(max=255) String solution,@NotNull @Size(max=100) List<@NotBlank @Size(max=255) String> subSolutions){}
