package com.airnote.model;

import java.util.Date;

public class SpeechLog {

	private int speechLogId;
	private int presentationId;
	private int pageNo;
	private String speechText;
	private Date detectedAt;
	private Date createdAt;

	public SpeechLog() {
	}

	public int getSpeechLogId() {
		return speechLogId;
	}

	public void setSpeechLogId(int speechLogId) {
		this.speechLogId = speechLogId;
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

	public String getSpeechText() {
		return speechText;
	}

	public void setSpeechText(String speechText) {
		this.speechText = speechText;
	}

	public Date getDetectedAt() {
		return detectedAt;
	}

	public void setDetectedAt(Date detectedAt) {
		this.detectedAt = detectedAt;
	}

	public Date getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Date createdAt) {
		this.createdAt = createdAt;
	}
}