package com.example.watchparty.model;

public class VideoCommand {
    private String type; // Ex: "PLAY", "PAUSE", "LOAD", "SEEK"
    private String videoId;
    private Double currentTime;

    // Campos para o chat
    private String sender;
    private String message;

    // Getters e Setters são necessários para que a biblioteca Jackson (usada pelo Spring)
    // possa converter o objeto para/de JSON automaticamente.

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getVideoId() {
        return videoId;
    }

    public void setVideoId(String videoId) {
        this.videoId = videoId;
    }

    public Double getCurrentTime() {
        return currentTime;
    }

    public void setCurrentTime(Double currentTime) {
        this.currentTime = currentTime;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    @Override
    public String toString() {
        return "VideoCommand{" +
                "type='" + type + '\'' +
                ", videoId='" + videoId + '\'' +
                ", currentTime=" + currentTime +
                '}';
    }
}
