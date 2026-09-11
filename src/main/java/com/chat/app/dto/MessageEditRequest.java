package com.chat.app.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MessageEditRequest {

    @NotBlank(message = "content must not be empty")
    private String content;
}