package com.airnote.model;

public class User {

	private int userId;
	private String name;
	private String email;
	private String password;
	private String joinDate;
	private String calibrationYn;
	private Double calibrationOffsetX;
	private Double calibrationOffsetY;
	private Double calibrationScaleX;
	private Double calibrationScaleY;
	private String calibrationMirrorYn;
	private Integer cameraWidth;
	private Integer cameraHeight;
	private Integer canvasWidth;
	private Integer canvasHeight;
	private String calibratedAt;

	public User() {
	}

	public int getUserId() {
		return userId;
	}

	public void setUserId(int userId) {
		this.userId = userId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public String getJoinDate() {
		return joinDate;
	}

	public void setJoinDate(String joinDate) {
		this.joinDate = joinDate;
	}

	public String getCalibrationYn() {
		return calibrationYn;
	}

	public void setCalibrationYn(String calibrationYn) {
		this.calibrationYn = calibrationYn;
	}

	public Double getCalibrationOffsetX() {
		return calibrationOffsetX;
	}

	public void setCalibrationOffsetX(Double calibrationOffsetX) {
		this.calibrationOffsetX = calibrationOffsetX;
	}

	public Double getCalibrationOffsetY() {
		return calibrationOffsetY;
	}

	public void setCalibrationOffsetY(Double calibrationOffsetY) {
		this.calibrationOffsetY = calibrationOffsetY;
	}

	public Double getCalibrationScaleX() {
		return calibrationScaleX;
	}

	public void setCalibrationScaleX(Double calibrationScaleX) {
		this.calibrationScaleX = calibrationScaleX;
	}

	public Double getCalibrationScaleY() {
		return calibrationScaleY;
	}

	public void setCalibrationScaleY(Double calibrationScaleY) {
		this.calibrationScaleY = calibrationScaleY;
	}

	public String getCalibrationMirrorYn() {
		return calibrationMirrorYn;
	}

	public void setCalibrationMirrorYn(String calibrationMirrorYn) {
		this.calibrationMirrorYn = calibrationMirrorYn;
	}

	public Integer getCameraWidth() {
		return cameraWidth;
	}

	public void setCameraWidth(Integer cameraWidth) {
		this.cameraWidth = cameraWidth;
	}

	public Integer getCameraHeight() {
		return cameraHeight;
	}

	public void setCameraHeight(Integer cameraHeight) {
		this.cameraHeight = cameraHeight;
	}

	public Integer getCanvasWidth() {
		return canvasWidth;
	}

	public void setCanvasWidth(Integer canvasWidth) {
		this.canvasWidth = canvasWidth;
	}

	public Integer getCanvasHeight() {
		return canvasHeight;
	}

	public void setCanvasHeight(Integer canvasHeight) {
		this.canvasHeight = canvasHeight;
	}

	public String getCalibratedAt() {
		return calibratedAt;
	}

	public void setCalibratedAt(String calibratedAt) {
		this.calibratedAt = calibratedAt;
	}
}