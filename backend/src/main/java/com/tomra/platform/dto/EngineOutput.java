package com.tomra.platform.dto;

public class EngineOutput {

  private Long id; // ✅ NEW

  private String deviceId;
  private String imageName;
  private String predictedLabel;
  private Float confidence;
  private String model;
  private Integer classId;
  private Double latency;
  private String imageURL;
  private double powerUsage;
  private double co2Emissions;

  public EngineOutput(
      Long id, // ✅ NEW
      String deviceId,
      String imageName,
      String predictedLabel,
      Float confidence,
      String model,
      Integer classId,
      Double latency,
      String imageURL,
      double powerUsage,
      double co2Emissions
  ) {
    this.id = id; // ✅ NEW
    this.deviceId = deviceId;
    this.imageName = imageName;
    this.predictedLabel = predictedLabel;
    this.confidence = confidence;
    this.model = model;
    this.classId = classId;
    this.latency = latency;
    this.imageURL = imageURL;
    this.powerUsage = powerUsage;
    this.co2Emissions = co2Emissions;
  }

  public Long getId() { return id; } // ✅ NEW

  public String getDeviceId() { return deviceId; }
  public String getImageName() { return imageName; }
  public String getPredictedLabel() { return predictedLabel; }
  public Float getConfidence() { return confidence; }
  public String getModel() { return model; }
  public Integer getClassId() { return classId; }
  public Double getLatency() { return latency; }
  public String getImageURL() { return imageURL; }
  public double getPowerUsage() { return powerUsage; }
  public double getCO2Emissions() { return co2Emissions; }
}