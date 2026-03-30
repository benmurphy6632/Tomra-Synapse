package com.tomra.platform.model;

import jakarta.persistence.*;

@Entity
@Table(
    name = "feedback_votes",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"project_id", "result_id"})
    }
)
public class FeedbackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id")
    private String projectId;

    @Column(name = "result_id")
    private Long resultId;

    @Column(name = "vote")
    private String vote;

    @Column(name = "model")
    private String model;

    @Column(name = "image_name")
    private String imageName;

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "image_url")
    private String imageURL;

    public FeedbackEntity() {}

    public Long getId() {
        return id;
    }

    public String getProjectId() {
        return projectId;
    }

    public Long getResultId() {
        return resultId;
    }

    public String getVote() {
        return vote;
    }

    public String getModel() {
        return model;
    }

    public String getImageName() {
        return imageName;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public String getImageURL() {
        return imageURL;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public void setResultId(Long resultId) {
        this.resultId = resultId;
    }

    public void setVote(String vote) {
        this.vote = vote;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public void setImageName(String imageName) {
        this.imageName = imageName;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public void setImageURL(String imageURL) {
        this.imageURL = imageURL;
    }
}