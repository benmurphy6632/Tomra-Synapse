package com.tomra.platform.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class ClassificationResultEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String projectId;
  private String deviceId;
  private String imageName;
  private String predictedLabel;
  private double confidence;
  private String model;
  private int classId;
  private double latency;
  private String imageURL;
  private double powerUsage;
  private double co2Emissions;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public String getProjectId() { return projectId; }
  public void setProjectId(String projectId) { this.projectId = projectId; }

  public String getDeviceId() { return deviceId; }
  public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

  public String getImageName() { return imageName; }
  public void setImageName(String imageName) { this.imageName = imageName; }

  public String getPredictedLabel() { return predictedLabel; }
  public void setPredictedLabel(String predictedLabel) { this.predictedLabel = predictedLabel; }

  public double getConfidence() { return confidence; }
  public void setConfidence(double confidence) { this.confidence = confidence; }

  public String getModel() { return model; }
  public void setModel(String model) { this.model = model; }

  public int getClassId() { return classId; }
  public void setClassId(int classId) { this.classId = classId; }

  public double getLatency() { return latency; }
  public void setLatency(double latency) { this.latency = latency; }

  public String getImageURL() { return imageURL; }
  public void setImageURL(String imageURL) { this.imageURL = imageURL; }

  public double getPowerUsage() { return powerUsage; }
  public void setPowerUsage(double powerUsage) { this.powerUsage = powerUsage; }

  public double getCO2Emissions() { return co2Emissions; }
  public void setCO2Emissions(double co2Emissions) { this.co2Emissions = co2Emissions; }
}
