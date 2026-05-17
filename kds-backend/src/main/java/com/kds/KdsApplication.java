package com.kds;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KdsApplication {
    public static void main(String[] args) {
        SpringApplication.run(KdsApplication.class, args);
    }
}
