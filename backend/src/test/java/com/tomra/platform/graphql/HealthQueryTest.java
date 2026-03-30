package com.tomra.platform.graphql;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tomra.platform.dto.Health;
import com.tomra.platform.dto.ServiceStatus;

/**
 * Unit tests for HealthQuery matching GraphQL Health schema:
 * status, uptime, services (name, status).
 */
class HealthQueryTest {

  private HealthQuery healthQuery;

  @BeforeEach
  void setUp() {
    healthQuery = new HealthQuery();
  }

  @Test
  void health_returnsUpStatus() {
    Health result = healthQuery.health();

    assertNotNull(result);
    assertEquals("UP", result.status());
  }

  @Test
  void health_returnsUptime() {
    Health result = healthQuery.health();

    assertNotNull(result);
    assertTrue(result.uptime() >= 0, "uptime should be non-negative");
  }

  @Test
  void health_returnsDatabaseAndServerServices() {
    Health result = healthQuery.health();

    assertNotNull(result);
    List<ServiceStatus> services = result.services();
    assertNotNull(services);
    assertEquals(2, services.size());

    ServiceStatus database = services.get(0);
    assertEquals("database", database.name());
    assertEquals("UP", database.status());

    ServiceStatus server = services.get(1);
    assertEquals("server", server.name());
    assertEquals("UP", server.status());
  }

  @Test
  void health_returnsPositiveUptime() {
    Health result = healthQuery.health();

    assertNotNull(result);
    assertTrue(result.uptime() >= 0, "uptime should be non-negative");
  }
}