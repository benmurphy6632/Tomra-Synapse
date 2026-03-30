package com.tomra.platform.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT settings for authenticating edge devices to the gRPC server.
 * Edge sends {@code Authorization: Bearer &lt;jwt&gt;} metadata; server verifies HS256 with shared secret.
 */
@ConfigurationProperties(prefix = "edge.grpc.jwt")
public class EdgeJwtProperties {

  /**
   * When false, gRPC requests are not checked for JWT (local dev / tests).
   */
  private boolean enabled = true;

  /**
   * Shared secret for HS256; must be at least 256 bits (32+ ASCII chars) for HMAC-SHA256.
   * Override in production via env or config.
   */
  private String secret = "tomra-edge-jwt-dev-secret-min-32b!!";

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getSecret() {
    return secret;
  }

  public void setSecret(String secret) {
    this.secret = secret;
  }
}
