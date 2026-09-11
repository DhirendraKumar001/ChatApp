package com.chat.app.controller;

import com.chat.app.dto.MessageEditRequest;
import com.chat.app.dto.MessageRequest;
import com.chat.app.dto.MessageResponse;
import com.chat.app.service.ChatNotificationService;
import com.chat.app.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final ChatNotificationService notificationService;


    @PostMapping
    public ResponseEntity<MessageResponse> sendMessage(@Valid @RequestBody MessageRequest request,
                                                       Authentication authentication) {
        MessageResponse response = messageService.sendMessage(
                authentication.getName(), request.getReceiverUsername(), request.getContent());
        notificationService.notifyNewMessage(response);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }


    @GetMapping("/{otherUsername}")
    public ResponseEntity<Page<MessageResponse>> getConversation(
            @PathVariable String otherUsername,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "sentAt"));
        Page<MessageResponse> conversation =
                messageService.getConversation(authentication.getName(), otherUsername, pageable);
        return ResponseEntity.ok(conversation);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessageResponse> editMessage(@PathVariable Long id,
                                                       @Valid @RequestBody MessageEditRequest request,
                                                       Authentication authentication) {
        MessageResponse response = messageService.editMessage(id, authentication.getName(), request.getContent());
        notificationService.notifyMessageEdited(response);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a message "from my profile". Any participant of the conversation (sender OR
     * receiver) may do this for any message in that conversation; it only removes the
     * message from their own view, not the other participant's. Only the deleting user's
     * own other sessions/devices are notified over WebSocket - see ChatNotificationService.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long id, Authentication authentication) {
        messageService.deleteMessageForCurrentUser(id, authentication.getName());
        notificationService.notifyMessageDeleted(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}