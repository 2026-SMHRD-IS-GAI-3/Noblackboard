package com.airnote.model;

public class TextAnchor {

	private int anchorId;
	private int pdfId;
	private int pageNo;
	private String textOriginal;
	private String textNormalized;
	private String keywords;
	private double xRatio;
	private double yRatio;
	private double widthRatio;
	private double heightRatio;
	private double startXRatio;
	private double startYRatio;
	private double endXRatio;
	private double endYRatio;
	private String coordSystem;
	private String extractSource;
	private double confidence;

	public int getAnchorId() {
		return anchorId;
	}

	public void setAnchorId(int anchorId) {
		this.anchorId = anchorId;
	}

	public int getPdfId() {
		return pdfId;
	}

	public void setPdfId(int pdfId) {
		this.pdfId = pdfId;
	}

	public int getPageNo() {
		return pageNo;
	}

	public void setPageNo(int pageNo) {
		this.pageNo = pageNo;
	}

	public String getTextOriginal() {
		return textOriginal;
	}

	public void setTextOriginal(String textOriginal) {
		this.textOriginal = textOriginal;
	}

	public String getTextNormalized() {
		return textNormalized;
	}

	public void setTextNormalized(String textNormalized) {
		this.textNormalized = textNormalized;
	}

	public String getKeywords() {
		return keywords;
	}

	public void setKeywords(String keywords) {
		this.keywords = keywords;
	}

	public double getxRatio() {
		return xRatio;
	}

	public void setxRatio(double xRatio) {
		this.xRatio = xRatio;
	}

	public double getyRatio() {
		return yRatio;
	}

	public void setyRatio(double yRatio) {
		this.yRatio = yRatio;
	}

	public double getWidthRatio() {
		return widthRatio;
	}

	public void setWidthRatio(double widthRatio) {
		this.widthRatio = widthRatio;
	}

	public double getHeightRatio() {
		return heightRatio;
	}

	public void setHeightRatio(double heightRatio) {
		this.heightRatio = heightRatio;
	}

	public double getStartXRatio() {
		return startXRatio;
	}

	public void setStartXRatio(double startXRatio) {
		this.startXRatio = startXRatio;
	}

	public double getStartYRatio() {
		return startYRatio;
	}

	public void setStartYRatio(double startYRatio) {
		this.startYRatio = startYRatio;
	}

	public double getEndXRatio() {
		return endXRatio;
	}

	public void setEndXRatio(double endXRatio) {
		this.endXRatio = endXRatio;
	}

	public double getEndYRatio() {
		return endYRatio;
	}

	public void setEndYRatio(double endYRatio) {
		this.endYRatio = endYRatio;
	}

	public String getCoordSystem() {
		return coordSystem;
	}

	public void setCoordSystem(String coordSystem) {
		this.coordSystem = coordSystem;
	}

	public String getExtractSource() {
		return extractSource;
	}

	public void setExtractSource(String extractSource) {
		this.extractSource = extractSource;
	}

	public double getConfidence() {
		return confidence;
	}

	public void setConfidence(double confidence) {
		this.confidence = confidence;
	}
}