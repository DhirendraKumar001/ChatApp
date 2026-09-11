package com.chat.app.service;

import com.chat.app.dto.MessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Pushes live updates over the private per-user STOMP queue set up in WebSocketConfig.
 * Used by both MessageController (REST) and ChatWebSocketController (STOMP) so a
 * message sent through either channel is delivered live through both.
 */
@Service
@RequiredArgsConstructor
public class ChatNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    /** A new message: pushed to the receiver, and echoed back to the sender's other open sessions/devices. */
    public void notifyNewMessage(MessageResponse message) {
        messagingTemplate.convertAndSendToUser(message.getReceiverUsername(), "/queue/messages", message);
        messagingTemplate.convertAndSendToUser(message.getSenderUsername(), "/queue/messages", message);
    }

    /** An edit changes content everyone sees, so both participants are notified. */
    public void notifyMessageEdited(MessageResponse message) {
        messagingTemplate.convertAndSendToUser(message.getReceiverUsername(), "/queue/messages.updated", message);
        messagingTemplate.convertAndSendToUser(message.getSenderUsername(), "/queue/messages.updated", message);
    }

    /**
     * "Delete from profile" only removes the message from the deleting user's own view
     * (see MessageService) - the other participant is unaffected and is NOT notified.
     * This only syncs the deleting user's other own devices/tabs.
     */
    public void notifyMessageDeleted(String forUsername, Long messageId) {
        messagingTemplate.convertAndSendToUser(forUsername, "/queue/messages.deleted", messageId);
    }
}