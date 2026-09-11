package com.chat.app.service;

import com.chat.app.dto.MessageResponse;
import com.chat.app.model.Message;
import com.chat.app.model.MessageDeletion;
import com.chat.app.model.User;
import com.chat.app.exception.ResourceNotFoundException;
import com.chat.app.exception.UnauthorizedActionException;
import com.chat.app.repository.MessageDeletionRepository;
import com.chat.app.repository.MessageRepository;
import com.chat.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final MessageDeletionRepository messageDeletionRepository;
    private final UserRepository userRepository;

    @Transactional
    public MessageResponse sendMessage(String senderUsername, String receiverUsername, String content) {
        if (senderUsername.equals(receiverUsername)) {
            throw new IllegalArgumentException("You cannot send a message to yourself");
        }

        User sender = getUserOrThrow(senderUsername);
        User receiver = getUserOrThrow(receiverUsername);

        Message message = Message.builder()
                .sender(sender)
                .receiver(receiver)
                .content(content)
                .build();

        Message saved = messageRepository.save(message);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<MessageResponse> getConversation(String currentUsername, String otherUsername, Pageable pageable) {
        User current = getUserOrThrow(currentUsername);
        User other = getUserOrThrow(otherUsername);

        Page<Message> page = messageRepository.findConversation(current.getId(), other.getId(), pageable);

        // Filter out messages the current user has deleted "from their profile".
        List<Long> ids = page.getContent().stream().map(Message::getId).toList();
        Set<Long> deletedForCurrentUser = messageDeletionRepository
                .findAllByUserIdAndMessageIdIn(current.getId(), ids)
                .stream()
                .map(md -> md.getMessage().getId())
                .collect(Collectors.toSet());

        List<MessageResponse> visible = page.getContent().stream()
                .filter(m -> !deletedForCurrentUser.contains(m.getId()))
                .map(this::toResponse)
                .toList();

        return new org.springframework.data.domain.PageImpl<>(visible, pageable, page.getTotalElements());
    }

    @Transactional
    public MessageResponse editMessage(Long messageId, String currentUsername, String newContent) {
        Message message = getMessageOrThrow(messageId);

        if (!message.getSender().getUsername().equals(currentUsername)) {
            throw new UnauthorizedActionException("You can only edit your own messages");
        }

        message.setContent(newContent);
        message.setEdited(true);
        message.setEditedAt(LocalDateTime.now());

        Message saved = messageRepository.save(message);
        return toResponse(saved);
    }

    @Transactional
    public void deleteMessageForCurrentUser(Long messageId, String currentUsername) {
        Message message = getMessageOrThrow(messageId);
        User current = getUserOrThrow(currentUsername);

        boolean isParticipant = message.getSender().getId().equals(current.getId())
                || message.getReceiver().getId().equals(current.getId());

        if (!isParticipant) {
            throw new UnauthorizedActionException("You can only delete messages from conversations you are part of");
        }

        if (messageDeletionRepository.existsByMessageIdAndUserId(messageId, current.getId())) {
            // Already deleted for this user - idempotent no-op.
            return;
        }

        MessageDeletion deletion = MessageDeletion.builder()
                .message(message)
                .user(current)
                .build();

        messageDeletionRepository.save(deletion);
    }

    private User getUserOrThrow(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    private Message getMessageOrThrow(Long id) {
        return messageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + id));
    }

    private MessageResponse toResponse(Message m) {
        return MessageResponse.builder()
                .id(m.getId())
                .senderUsername(m.getSender().getUsername())
                .receiverUsername(m.getReceiver().getUsername())
                .content(m.getContent())
                .sentAt(m.getSentAt())
                .edited(m.isEdited())
                .editedAt(m.getEditedAt())
                .build();
    }
}