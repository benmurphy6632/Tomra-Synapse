package com.tomra.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.tomra.platform.config.EdgeJwtProperties;

@SpringBootApplication
@EnableConfigurationProperties(EdgeJwtProperties.class)
public class PlatformBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PlatformBackendApplication.class, args);
	}

}
