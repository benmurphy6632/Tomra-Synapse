package com.tomra.platform.security.jwt;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import com.tomra.platform.config.EdgeJwtProperties;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Validates JWTs signed with the shared edge secret (HS256).
 */
@Component
public class JwtValidator {

  private final EdgeJwtProperties props;
  private final SecretKey key;

  public JwtValidator(EdgeJwtProperties props) {
    this.props = props;
    this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Verifies signature and standard claims (exp if present). Throws on invalid token.
   */
  public void assertValidToken(String token) {
    Jwts.parser()
        .verifyWith(key)
        .build()
        .parseSignedClaims(token);
  }
}
