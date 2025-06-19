package com.example.watchparty.handler;

import com.example.watchparty.model.VideoCommand;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class WatchPartyWebSocketHandler extends TextWebSocketHandler {
    // Lista thread-safe para armazenar as sessões ativas. Essencial para ambientes concorrentes.
    private final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    // ObjectMapper para converter objetos Java para JSON e vice-versa.
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Armazena o último comando (estado do vídeo) para sincronizar novos usuários.
    private VideoCommand lastVideoCommand = null;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("Nova conexão estabelecida: " + session.getId());
        sessions.add(session);

        // Se já houver um vídeo em andamento, envia o estado atual para o novo cliente
        if (lastVideoCommand != null) {
            try {
                String lastCommandAsJson = objectMapper.writeValueAsString(lastVideoCommand);
                session.sendMessage(new TextMessage(lastCommandAsJson));
                System.out.println("Enviando estado atual do vídeo para " + session.getId() + ": " + lastCommandAsJson);
            } catch (IOException e) {
                System.err.println("Erro ao enviar estado inicial para a sessão " + session.getId() + ": " + e.getMessage());
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.println("Mensagem recebida de " + session.getId() + ": " + payload);

        try {
            VideoCommand command = objectMapper.readValue(payload, VideoCommand.class);

            switch (command.getType()) {
                case "PLAY":
                case "PAUSE":
                case "SEEK":
                case "LOAD":
                    this.lastVideoCommand = command;
                    broadcast(payload);
                    break;
                case "CHAT":
                    broadcast(payload);
                    break;
                default:
                    System.err.println("Comando desconhecido recebido: " + command.getType());
            }

        } catch (JsonProcessingException e) {
            System.err.println("Erro ao processar JSON da sessão " + session.getId() + ": " + payload);
            // Opcional: enviar uma mensagem de erro de volta para o cliente
            // session.sendMessage(new TextMessage("{\"error\":\"Formato de JSON inválido\"}"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        System.out.println("Conexão fechada: " + session.getId() + " com status " + status.getCode());
        sessions.remove(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("Erro de transporte na sessão " + session.getId() + ": " + exception.getMessage());
        if (session.isOpen()) {
            session.close();
        }
        sessions.remove(session);
    }

    /**
     * Envia uma mensagem para todas as sessões conectadas.
     * @param message A mensagem a ser enviada (em formato de string/JSON).
     */
    private void broadcast(String message) {
        System.out.println("Fazendo broadcast da mensagem: " + message);
        TextMessage textMessage = new TextMessage(message);

        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(textMessage);
                } catch (IOException e) {
                    System.err.println("Erro ao enviar mensagem para sessão " + session.getId() + ": " + e.getMessage());
                }
            }
        }
    }
}
