package com.airnote.model;

import java.util.List;
import java.util.Map;

public class PresentationReport {

	private int presentationId;
	private int totalDurationSec;
	private String totalDurationText;
	private int mostViewedPageNo;
	private int mostViewedDurationSec;
	private int pageMoveCount;
	private AnnotationSummary annotationSummary;
	private List<SlideDuration> slideDurations;

	// 음성 습관 분석 결과
	private Map<String, Object> speechHabitAnalysis;

	public PresentationReport() {
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
	}

	public int getTotalDurationSec() {
		return totalDurationSec;
	}

	public void setTotalDurationSec(int totalDurationSec) {
		this.totalDurationSec = totalDurationSec;
	}

	public String getTotalDurationText() {
		return totalDurationText;
	}

	public void setTotalDurationText(String totalDurationText) {
		this.totalDurationText = totalDurationText;
	}

	public int getMostViewedPageNo() {
		return mostViewedPageNo;
	}

	public void setMostViewedPageNo(int mostViewedPageNo) {
		this.mostViewedPageNo = mostViewedPageNo;
	}

	public int getMostViewedDurationSec() {
		return mostViewedDurationSec;
	}

	public void setMostViewedDurationSec(int mostViewedDurationSec) {
		this.mostViewedDurationSec = mostViewedDurationSec;
	}

	public int getPageMoveCount() {
		return pageMoveCount;
	}

	public void setPageMoveCount(int pageMoveCount) {
		this.pageMoveCount = pageMoveCount;
	}

	public AnnotationSummary getAnnotationSummary() {
		return annotationSummary;
	}

	public void setAnnotationSummary(AnnotationSummary annotationSummary) {
		this.annotationSummary = annotationSummary;
	}

	public List<SlideDuration> getSlideDurations() {
		return slideDurations;
	}

	public void setSlideDurations(List<SlideDuration> slideDurations) {
		this.slideDurations = slideDurations;
	}

	public Map<String, Object> getSpeechHabitAnalysis() {
		return speechHabitAnalysis;
	}

	public void setSpeechHabitAnalysis(Map<String, Object> speechHabitAnalysis) {
		this.speechHabitAnalysis = speechHabitAnalysis;
	}
}