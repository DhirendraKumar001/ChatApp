package com.chat.app.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MessageRequest {

    @NotBlank(message = "receiverUsername is required")
    private String receiverUsername;

    @NotBlank(message = "content must not be empty")
    private String content;
}