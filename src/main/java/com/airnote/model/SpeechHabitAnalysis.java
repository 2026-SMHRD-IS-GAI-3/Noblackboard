package com.airnote.model;

import java.util.Date;

public class SpeechHabitAnalysis {

	private int analysisId;
	private int presentationId;
	private String fillerWord;
	private int fillerCount;
	private Date createdAt;

	public SpeechHabitAnalysis() {
	}

	public SpeechHabitAnalysis(String fillerWord, int fillerCount) {
		this.fillerWord = fillerWord;
		this.fillerCount = fillerCount;
	}

	public int getAnalysisId() {
		return analysisId;
	}

	public void setAnalysisId(int analysisId) {
		this.analysisId = analysisId;
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
	}

	public String getFillerWord() {
		return fillerWord;
	}

	public void setFillerWord(String fillerWord) {
		this.fillerWord = fillerWord;
	}

	public int getFillerCount() {
		return fillerCount;
	}

	public void setFillerCount(int fillerCount) {
		this.fillerCount = fillerCount;
	}

	public Date getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Date createdAt) {
		this.createdAt = createdAt;
	}
}