package com.airnote.model;

import java.util.Date;

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
	private int anchorId;
	private int matchLogId;
	private String sourceType;
	private double matchConfidence;
	private Date createdAt;

	// 삭제 처리용 컬럼
	private String deletedYn;
	private Date deletedAt;
	private String deleteType;

	public Annotation() {
	}

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

	public int getAnchorId() {
		return anchorId;
	}

	public void setAnchorId(int anchorId) {
		this.anchorId = anchorId;
	}

	public int getMatchLogId() {
		return matchLogId;
	}

	public void setMatchLogId(int matchLogId) {
		this.matchLogId = matchLogId;
	}

	public String getSourceType() {
		return sourceType;
	}

	public void setSourceType(String sourceType) {
		this.sourceType = sourceType;
	}

	public double getMatchConfidence() {
		return matchConfidence;
	}

	public void setMatchConfidence(double matchConfidence) {
		this.matchConfidence = matchConfidence;
	}

	public Date getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Date createdAt) {
		this.createdAt = createdAt;
	}

	public String getDeletedYn() {
		return deletedYn;
	}

	public void setDeletedYn(String deletedYn) {
		this.deletedYn = deletedYn;
	}

	public Date getDeletedAt() {
		return deletedAt;
	}

	public void setDeletedAt(Date deletedAt) {
		this.deletedAt = deletedAt;
	}

	public String getDeleteType() {
		return deleteType;
	}

	public void setDeleteType(String deleteType) {
		this.deleteType = deleteType;
	}
}