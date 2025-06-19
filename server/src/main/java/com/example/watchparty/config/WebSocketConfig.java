package com.example.watchparty.config;

import com.example.watchparty.handler.WatchPartyWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket // Habilita o suporte a WebSocket no Spring
public class WebSocketConfig implements WebSocketConfigurer {
    private final WatchPartyWebSocketHandler watchPartyWebSocketHandler;

    // Injeção de dependência do nosso handler
    public WebSocketConfig(WatchPartyWebSocketHandler watchPartyWebSocketHandler) {
        this.watchPartyWebSocketHandler = watchPartyWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Registra o handler no endpoint "/watchparty"
        // setAllowedOrigins("*") permite conexões de qualquer origem (útil para desenvolvimento)
        // Em produção, você deve restringir para o domínio do seu frontend.
        registry.addHandler(watchPartyWebSocketHandler, "/watchparty").setAllowedOrigins("*");
    }
}
