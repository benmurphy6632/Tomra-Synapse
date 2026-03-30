package com.tomra.platform.config;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

class CorsConfigTest {

    // Subclass to expose the protected getCorsConfigurations() method
    static class InspectableCorsRegistry extends CorsRegistry {
        public Map<String, CorsConfiguration> getConfigurations() {
            return getCorsConfigurations();
        }
    }

    private CorsConfig corsConfig;
    private InspectableCorsRegistry registry;

    @BeforeEach
    void setUp() {
        corsConfig = new CorsConfig();
        registry = new InspectableCorsRegistry();
        corsConfig.addCorsMappings(registry);
    }

    @Test
    void addCorsMappings_registersWildcardPath() {
        Map<String, CorsConfiguration> configs = registry.getConfigurations();
        assertNotNull(configs);
        assertTrue(configs.containsKey("/**"),
                "Expected '/**' path mapping but got: " + configs.keySet());
    }

    @Test
    void addCorsMappings_allowsLocalhostOrigins() {
        CorsConfiguration config = registry.getConfigurations().get("/**");
        assertNotNull(config);

        List<String> origins = config.getAllowedOrigins();
        assertNotNull(origins);
        assertTrue(origins.contains("http://localhost:3000"), "Missing localhost:3000");
        assertTrue(origins.contains("http://localhost:3001"), "Missing localhost:3001");
        assertTrue(origins.contains("http://localhost:5173"), "Missing localhost:5173");
    }

    @Test
    void addCorsMappings_allowsExpectedHttpMethods() {
        CorsConfiguration config = registry.getConfigurations().get("/**");
        assertNotNull(config);

        List<String> methods = config.getAllowedMethods();
        assertNotNull(methods);
        assertTrue(methods.contains("GET"), "Missing GET");
        assertTrue(methods.contains("POST"), "Missing POST");
        assertTrue(methods.contains("OPTIONS"), "Missing OPTIONS");
    }

    @Test
    void addCorsMappings_allowsAllHeaders() {
        CorsConfiguration config = registry.getConfigurations().get("/**");
        assertNotNull(config);

        List<String> headers = config.getAllowedHeaders();
        assertNotNull(headers);
        assertTrue(headers.contains("*"), "Expected wildcard '*' in allowed headers");
    }

    @Test
    void addCorsMappings_exactlyThreeOriginsAllowed() {
        CorsConfiguration config = registry.getConfigurations().get("/**");
        assertNotNull(config);

        List<String> origins = config.getAllowedOrigins();
        assertNotNull(origins);
        assertTrue(origins.size() == 3,
                "Expected exactly 3 allowed origins but got: " + origins.size());
    }
}