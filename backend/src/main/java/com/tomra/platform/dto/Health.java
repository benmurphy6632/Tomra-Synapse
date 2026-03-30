package com.tomra.platform.dto;

import java.util.List;

public record Health(String status, Double uptime, List<ServiceStatus> services) {
}
