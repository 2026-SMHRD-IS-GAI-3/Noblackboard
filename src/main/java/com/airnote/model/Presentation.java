package com.airnote.model;

import java.sql.Date;

public class Presentation {

	private int presentationId;
	private int userId;
	private int pdfId;
	private Date startTime;
	private Date endTime;

	public Presentation() {
	}

	public Presentation(int userId, int pdfId) {
		this.userId = userId;
		this.pdfId = pdfId;
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
	}

	public int getUserId() {
		return userId;
	}

	public void setUserId(int userId) {
		this.userId = userId;
	}

	public int getPdfId() {
		return pdfId;
	}

	public void setPdfId(int pdfId) {
		this.pdfId = pdfId;
	}

	public Date getStartTime() {
		return startTime;
	}

	public void setStartTime(Date startTime) {
		this.startTime = startTime;
	}

	public Date getEndTime() {
		return endTime;
	}

	public void setEndTime(Date endTime) {
		this.endTime = endTime;
	}
}