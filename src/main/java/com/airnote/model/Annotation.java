package com.airnote.model;

// 밑줄, 형광펜, 포인터 등 실제 판서 기록 정보를 담는 모델 클래스

public class Annotation {

	private int annotationId;
	private int presentationId;
	private int pageNo;
	private String toolType;
	private String color;
	private double startX;
	private double startY;
	private double endX;
	private double endY;
	private Integer anchorId;
	private Integer matchLogId;
	private String sourceType;
	private Double matchConfidence;

	public int getAnnotationId() {
		return annotationId;
	}

	public void setAnnotationId(int annotationId) {
		this.annotationId = annotationId;
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
	}

	public int getPageNo() {
		return pageNo;
	}

	public void setPageNo(int pageNo) {
		this.pageNo = pageNo;
	}

	public String getToolType() {
		return toolType;
	}

	public void setToolType(String toolType) {
		this.toolType = toolType;
	}

	public String getColor() {
		return color;
	}

	public void setColor(String color) {
		this.color = color;
	}

	public double getStartX() {
		return startX;
	}

	public void setStartX(double startX) {
		this.startX = startX;
	}

	public double getStartY() {
		return startY;
	}

	public void setStartY(double startY) {
		this.startY = startY;
	}

	public double getEndX() {
		return endX;
	}

	public void setEndX(double endX) {
		this.endX = endX;
	}

	public double getEndY() {
		return endY;
	}

	public void setEndY(double endY) {
		this.endY = endY;
	}

	public Integer getAnchorId() {
		return anchorId;
	}

	public void setAnchorId(Integer anchorId) {
		this.anchorId = anchorId;
	}

	public Integer getMatchLogId() {
		return matchLogId;
	}

	public void setMatchLogId(Integer matchLogId) {
		this.matchLogId = matchLogId;
	}

	public String getSourceType() {
		return sourceType;
	}

	public void setSourceType(String sourceType) {
		this.sourceType = sourceType;
	}

	public Double getMatchConfidence() {
		return matchConfidence;
	}

	public void setMatchConfidence(Double matchConfidence) {
		this.matchConfidence = matchConfidence;
	}
}