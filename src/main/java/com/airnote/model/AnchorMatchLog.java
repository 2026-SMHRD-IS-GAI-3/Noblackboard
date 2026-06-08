package com.airnote.model;

public class AnchorMatchLog {

	private int matchLogId;
	private int presentationId;
	private int pdfId;
	private int pageNo;

	private String sttText;
	private String sttNormalized;
	private String extractedKeywords;
	private Double sttConfidence;

	private String matchStatus;
	private Integer selectedAnchorId;

	private Double topScore;
	private Double secondScore;
	private Double scoreGap;
	private Integer candidateCount;

	private Double thresholdScore;
	private Double ambiguousGap;

	private String failReasonCode;
	private String decisionReason;
	private String matchAlgorithm;
	private String actionType;

	private Integer processTimeMs;

	public int getMatchLogId() {
		return matchLogId;
	}

	public void setMatchLogId(int matchLogId) {
		this.matchLogId = matchLogId;
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
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

	public String getSttText() {
		return sttText;
	}

	public void setSttText(String sttText) {
		this.sttText = sttText;
	}

	public String getSttNormalized() {
		return sttNormalized;
	}

	public void setSttNormalized(String sttNormalized) {
		this.sttNormalized = sttNormalized;
	}

	public String getExtractedKeywords() {
		return extractedKeywords;
	}

	public void setExtractedKeywords(String extractedKeywords) {
		this.extractedKeywords = extractedKeywords;
	}

	public Double getSttConfidence() {
		return sttConfidence;
	}

	public void setSttConfidence(Double sttConfidence) {
		this.sttConfidence = sttConfidence;
	}

	public String getMatchStatus() {
		return matchStatus;
	}

	public void setMatchStatus(String matchStatus) {
		this.matchStatus = matchStatus;
	}

	public Integer getSelectedAnchorId() {
		return selectedAnchorId;
	}

	public void setSelectedAnchorId(Integer selectedAnchorId) {
		this.selectedAnchorId = selectedAnchorId;
	}

	public Double getTopScore() {
		return topScore;
	}

	public void setTopScore(Double topScore) {
		this.topScore = topScore;
	}

	public Double getSecondScore() {
		return secondScore;
	}

	public void setSecondScore(Double secondScore) {
		this.secondScore = secondScore;
	}

	public Double getScoreGap() {
		return scoreGap;
	}

	public void setScoreGap(Double scoreGap) {
		this.scoreGap = scoreGap;
	}

	public Integer getCandidateCount() {
		return candidateCount;
	}

	public void setCandidateCount(Integer candidateCount) {
		this.candidateCount = candidateCount;
	}

	public Double getThresholdScore() {
		return thresholdScore;
	}

	public void setThresholdScore(Double thresholdScore) {
		this.thresholdScore = thresholdScore;
	}

	public Double getAmbiguousGap() {
		return ambiguousGap;
	}

	public void setAmbiguousGap(Double ambiguousGap) {
		this.ambiguousGap = ambiguousGap;
	}

	public String getFailReasonCode() {
		return failReasonCode;
	}

	public void setFailReasonCode(String failReasonCode) {
		this.failReasonCode = failReasonCode;
	}

	public String getDecisionReason() {
		return decisionReason;
	}

	public void setDecisionReason(String decisionReason) {
		this.decisionReason = decisionReason;
	}

	public String getMatchAlgorithm() {
		return matchAlgorithm;
	}

	public void setMatchAlgorithm(String matchAlgorithm) {
		this.matchAlgorithm = matchAlgorithm;
	}

	public String getActionType() {
		return actionType;
	}

	public void setActionType(String actionType) {
		this.actionType = actionType;
	}

	public Integer getProcessTimeMs() {
		return processTimeMs;
	}

	public void setProcessTimeMs(Integer processTimeMs) {
		this.processTimeMs = processTimeMs;
	}
}