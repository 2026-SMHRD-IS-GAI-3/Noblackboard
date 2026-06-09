package com.airnote.model;

// 업로드된 PDF 문서 정보를 담는 모델 클래스


public class PdfDocument {

	private int pdfId;
	private int userId;
	private String fileName;
	private Integer pageCount;

	public int getPdfId() {
		return pdfId;
	}

	public void setPdfId(int pdfId) {
		this.pdfId = pdfId;
	}

	public int getUserId() {
		return userId;
	}

	public void setUserId(int userId) {
		this.userId = userId;
	}

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}

	public Integer getPageCount() {
		return pageCount;
	}

	public void setPageCount(Integer pageCount) {
		this.pageCount = pageCount;
	}
}