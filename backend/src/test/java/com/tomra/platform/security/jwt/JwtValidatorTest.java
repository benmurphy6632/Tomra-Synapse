package com.tomra.platform.security.jwt;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import org.junit.jupiter.api.Test;

import com.tomra.platform.config.EdgeJwtProperties;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

class JwtValidatorTest {

  private static final String SECRET = "tomra-edge-jwt-dev-secret-min-32b!!";

  @Test
  void assertValidToken_acceptsSignedJwt() {
    EdgeJwtProperties props = new EdgeJwtProperties();
    props.setSecret(SECRET);
    props.setEnabled(true);
    JwtValidator validator = new JwtValidator(props);

    String token = Jwts.builder()
        .subject("edge-device")
        .issuedAt(new Date())
        .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
        .compact();

    assertDoesNotThrow(() -> validator.assertValidToken(token));
  }

  @Test
  void assertValidToken_rejectsWrongSignature() {
    EdgeJwtProperties props = new EdgeJwtProperties();
    props.setSecret(SECRET);
    JwtValidator validator = new JwtValidator(props);

    String bad = Jwts.builder()
        .subject("edge")
        .signWith(Keys.hmacShaKeyFor("wrong-secret-must-be-32-bytes-min!!".getBytes(StandardCharsets.UTF_8)))
        .compact();

    assertThrows(Exception.class, () -> validator.assertValidToken(bad));
  }

  @Test
  void assertValidToken_rejectsGarbage() {
    EdgeJwtProperties props = new EdgeJwtProperties();
    props.setSecret(SECRET);
    JwtValidator validator = new JwtValidator(props);

    assertThrows(Exception.class, () -> validator.assertValidToken("not-a-jwt"));
  }
}
