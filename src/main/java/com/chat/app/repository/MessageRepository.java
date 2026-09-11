package com.chat.app.repository;

import com.chat.app.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("""
            SELECT m FROM Message m
            WHERE (m.sender.id = :userAId AND m.receiver.id = :userBId)
               OR (m.sender.id = :userBId AND m.receiver.id = :userAId)
            ORDER BY m.sentAt DESC
            """)
    Page<Message> findConversation(@Param("userAId") Long userAId,
                                   @Param("userBId") Long userBId,
                                   Pageable pageable);
}