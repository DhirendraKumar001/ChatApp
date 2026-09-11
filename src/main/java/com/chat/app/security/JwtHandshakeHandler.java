package com.chat.app.security;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Collections;
import java.util.Map;

/**
 * Turns the username verified by {@link JwtHandshakeInterceptor} into the Principal
 * attached to this WebSocket/STOMP session. Every message on this session afterwards
 * (chat.send, subscriptions, SimpMessagingTemplate#convertAndSendToUser routing) is
 * tied to this Principal's name - the client's JSON payload is never trusted as the
 * source of "who sent this", only the session's own authenticated identity is.
 */
@Component
public class JwtHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(@NonNull ServerHttpRequest request, @NonNull WebSocketHandler wsHandler,
                                      @NonNull Map<String, Object> attributes) {
        String username = (String) attributes.get("username");
        return new UsernamePasswordAuthenticationToken(username, null, Collections.emptyList());
    }
}