package com.presales.pipeline.common.config;
import org.springframework.context.annotation.*;
import org.springframework.data.auditing.DateTimeProvider;
import java.time.*;
import java.util.Optional;

@Configuration
public class BusinessTime {
    public static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
    public static LocalDateTime now(){return LocalDateTime.now(ZONE).truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
    @Bean public DateTimeProvider businessDateTimeProvider(){return ()->Optional.of(now());}
}
