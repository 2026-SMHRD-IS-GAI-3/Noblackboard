package com.airnote.model;

// 저장된 발표 화면 이미지의 경로, 파일명, 크기 정보를 담는 모델 클래스

public class RecordImage {

	private int recordImageId;
	private int presentationId;
	private int pageNo;
	private String imageUrl;
	private String originalFileName;
	private String savedFileName;
	private long fileSize;
	private String createdAt;

	public int getRecordImageId() {
		return recordImageId;
	}

	public void setRecordImageId(int recordImageId) {
		this.recordImageId = recordImageId;
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

	public String getImageUrl() {
		return imageUrl;
	}

	public void setImageUrl(String imageUrl) {
		this.imageUrl = imageUrl;
	}

	public String getOriginalFileName() {
		return originalFileName;
	}

	public void setOriginalFileName(String originalFileName) {
		this.originalFileName = originalFileName;
	}

	public String getSavedFileName() {
		return savedFileName;
	}

	public void setSavedFileName(String savedFileName) {
		this.savedFileName = savedFileName;
	}

	public long getFileSize() {
		return fileSize;
	}

	public void setFileSize(long fileSize) {
		this.fileSize = fileSize;
	}

	public String getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(String createdAt) {
		this.createdAt = createdAt;
	}
	
	// TB_RECORD_IMAGE 테이블 한 줄 = RecordImage 객체 하나
	
	
	// 지금 모델 기준 DB 컬럼 매칭
	// RECORD_IMAGE_ID  	→ recordImageId
	// PRESENTATION_ID      → presentationId
	// PAGE_NO              → pageNo
	// IMAGE_URL            → imageUrl
	// ORIGINAL_FILE_NAME   → originalFileName
	// SAVED_FILE_NAME      → savedFileName
	// FILE_SIZE            → fileSize
	// CREATED_AT           → createdAt
	
}