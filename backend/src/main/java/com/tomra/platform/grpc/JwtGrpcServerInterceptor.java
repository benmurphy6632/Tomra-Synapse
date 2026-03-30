package com.tomra.platform.grpc;

import org.springframework.stereotype.Component;

import com.tomra.platform.config.EdgeJwtProperties;
import com.tomra.platform.security.jwt.JwtValidator;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;

/**
 * Requires {@code authorization} metadata with value {@code Bearer &lt;jwt&gt;} when JWT is enabled.
 */
@Component
public class JwtGrpcServerInterceptor implements ServerInterceptor {

  private static final Metadata.Key<String> AUTHORIZATION = Metadata.Key.of(
      "authorization",
      Metadata.ASCII_STRING_MARSHALLER);

  private static final String BEARER_PREFIX = "Bearer ";

  private final EdgeJwtProperties props;
  private final JwtValidator jwtValidator;

  public JwtGrpcServerInterceptor(EdgeJwtProperties props, JwtValidator jwtValidator) {
    this.props = props;
    this.jwtValidator = jwtValidator;
  }

  @Override
  public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
      ServerCall<ReqT, RespT> call,
      Metadata headers,
      ServerCallHandler<ReqT, RespT> next) {
    if (!props.isEnabled()) {
      return next.startCall(call, headers);
    }

    String authorization = headers.get(AUTHORIZATION);
    if (authorization == null || authorization.isBlank()) {
      call.close(Status.UNAUTHENTICATED.withDescription("Missing authorization metadata (Bearer JWT)"), new Metadata());
      return new ServerCall.Listener<ReqT>() {};
    }

    if (!authorization.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
      call.close(Status.UNAUTHENTICATED.withDescription("Authorization must be Bearer token"), new Metadata());
      return new ServerCall.Listener<ReqT>() {};
    }

    String token = authorization.substring(BEARER_PREFIX.length()).trim();
    try {
      jwtValidator.assertValidToken(token);
    } catch (Exception e) {
      call.close(
          Status.UNAUTHENTICATED.withDescription("Invalid JWT").withCause(e),
          new Metadata());
      return new ServerCall.Listener<ReqT>() {};
    }

    return next.startCall(call, headers);
  }
}
