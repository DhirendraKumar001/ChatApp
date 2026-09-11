package com.chat.app.repository;

import com.chat.app.model.MessageDeletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MessageDeletionRepository extends JpaRepository<MessageDeletion, Long> {

    boolean existsByMessageIdAndUserId(Long messageId, Long userId);

    List<MessageDeletion> findAllByUserIdAndMessageIdIn(Long userId, List<Long> messageIds);
}