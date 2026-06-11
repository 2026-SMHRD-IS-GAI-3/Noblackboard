package com.airnote.service;

import java.util.List;
import java.util.Map;

import com.airnote.dao.ReportDAO;
import com.airnote.model.AnnotationSummary;
import com.airnote.model.PresentationReport;
import com.airnote.model.SlideDuration;

public class ReportService {

	private ReportDAO reportDAO = new ReportDAO();

	public PresentationReport getPresentationReport(int presentationId) {
		if (presentationId <= 0) {
			return null;
		}

		int totalDurationSec = reportDAO.selectTotalDurationSec(presentationId);
		SlideDuration mostViewedSlide = reportDAO.selectMostViewedSlide(presentationId);
		int pageMoveCount = reportDAO.selectPageMoveCount(presentationId);
		AnnotationSummary annotationSummary = reportDAO.selectAnnotationSummary(presentationId);
		List<SlideDuration> slideDurations = reportDAO.selectSlideDurations(presentationId);
		Map<String, Object> speechHabitAnalysis = reportDAO.selectSpeechHabitAnalysis(presentationId);

		PresentationReport report = new PresentationReport();
		report.setPresentationId(presentationId);
		report.setTotalDurationSec(totalDurationSec);
		report.setTotalDurationText(formatDurationText(totalDurationSec));

		if (mostViewedSlide != null) {
			report.setMostViewedPageNo(mostViewedSlide.getPageNo());
			report.setMostViewedDurationSec(mostViewedSlide.getDurationSec());
		}

		report.setPageMoveCount(pageMoveCount);
		report.setAnnotationSummary(annotationSummary);
		report.setSlideDurations(slideDurations);
		report.setSpeechHabitAnalysis(speechHabitAnalysis);

		return report;
	}

	private String formatDurationText(int totalSeconds) {
		if (totalSeconds <= 0) {
			return "0초";
		}

		int minutes = totalSeconds / 60;
		int seconds = totalSeconds % 60;

		if (minutes > 0 && seconds > 0) {
			return minutes + "분 " + seconds + "초";
		}

		if (minutes > 0) {
			return minutes + "분";
		}

		return seconds + "초";
	}
}