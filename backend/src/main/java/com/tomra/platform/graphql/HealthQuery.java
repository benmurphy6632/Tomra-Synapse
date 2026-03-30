package com.tomra.platform.graphql;

import java.lang.management.ManagementFactory;
import java.util.List;

import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import com.tomra.platform.dto.Health;
import com.tomra.platform.dto.ServiceStatus;
import com.tomra.platform.repository.ClassificationResultRepository;

@Controller
public class HealthQuery {

  private final ClassificationResultRepository repository;

  public HealthQuery(ClassificationResultRepository repository) {
    this.repository = repository;
  }

  public HealthQuery() {
    this.repository = null;
  }

  @QueryMapping
  public Health health() {
    String dbStatus;
    try {
      if (repository != null) {
        repository.count();
      }
      dbStatus = "UP";
    } catch (Exception e) {
      dbStatus = "DOWN";
    }

    double uptime = ManagementFactory.getRuntimeMXBean().getUptime() / 1000.0;

    List<ServiceStatus> services = List.of(
        new ServiceStatus("database", dbStatus),
        new ServiceStatus("server", "UP"));

    return new Health("UP", uptime, services);
  }
}
