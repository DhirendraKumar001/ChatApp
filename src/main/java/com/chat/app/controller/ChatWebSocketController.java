package com.chat.app.controller;

import com.chat.app.dto.MessageRequest;
import com.chat.app.dto.MessageResponse;
import com.chat.app.service.ChatNotificationService;
import com.chat.app.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final MessageService messageService;
    private final ChatNotificationService notificationService;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload MessageRequest request, Principal principal) {
        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new IllegalArgumentException("content must not be empty");
        }
        if (request.getReceiverUsername() == null || request.getReceiverUsername().isBlank()) {
            throw new IllegalArgumentException("receiverUsername is required");
        }

        MessageResponse response = messageService.sendMessage(
                principal.getName(), request.getReceiverUsername(), request.getContent());

        notificationService.notifyNewMessage(response);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public String handleException(Exception ex) {
        return ex.getMessage();
    }
}