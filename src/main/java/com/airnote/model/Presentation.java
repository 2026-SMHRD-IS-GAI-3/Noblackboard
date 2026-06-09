package com.airnote.model;

// 발표 세션 정보와 저장 이미지 목록 recordImages를 담는 모델 클래스

import java.util.List;

public class Presentation {

	private int presentationId;
	private int userId;
	private int pdfId;
	private String startTime;
	private String endTime;

	// 발표 상세 조회에 같이 붙일 저장 이미지 목록
	private List<RecordImage> recordImages;

	public Presentation() {
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

	public String getStartTime() {
		return startTime;
	}

	public void setStartTime(String startTime) {
		this.startTime = startTime;
	}

	public String getEndTime() {
		return endTime;
	}

	public void setEndTime(String endTime) {
		this.endTime = endTime;
	}

	public List<RecordImage> getRecordImages() {
		return recordImages;
	}

	public void setRecordImages(List<RecordImage> recordImages) {
		this.recordImages = recordImages;
	}
}