package com.airnote.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.airnote.dao.SpeechDAO;
import com.airnote.model.SpeechHabitAnalysis;
import com.airnote.model.SpeechLog;

public class SpeechService {

	private SpeechDAO speechDAO = new SpeechDAO();

	public int saveSpeechLog(int presentationId, int pageNo, String speechText) {
		if (presentationId <= 0) {
			return 0;
		}

		if (isBlank(speechText)) {
			return 0;
		}

		SpeechLog speechLog = new SpeechLog();
		speechLog.setPresentationId(presentationId);
		speechLog.setPageNo(pageNo);
		speechLog.setSpeechText(speechText.trim());

		return speechDAO.insertSpeechLog(speechLog);
	}

	public Map<String, Object> analyzeSpeechHabit(int presentationId) {
		if (presentationId <= 0) {
			return null;
		}

		List<String> speechTexts = speechDAO.selectSpeechTextsByPresentationId(presentationId);

		if (speechTexts == null || speechTexts.isEmpty()) {
			Map<String, Object> emptyResult = new LinkedHashMap<>();
			emptyResult.put("presentationId", presentationId);
			emptyResult.put("totalFillerCount", 0);
			emptyResult.put("fillerWords", createFillerWordResult(0, 0, 0));
			return emptyResult;
		}

		StringBuilder allTextBuilder = new StringBuilder();

		for (String text : speechTexts) {
			if (!isBlank(text)) {
				allTextBuilder.append(text).append(" ");
			}
		}

		String allText = allTextBuilder.toString();

		int eumCount = countExactWord(allText, "음");
		int eoCount = countExactWord(allText, "어");
		int ahCount = countExactWord(allText, "아");

		// 분석 API는 여러 번 실행될 수 있으니까 기존 결과 삭제 후 다시 저장
		speechDAO.deleteHabitAnalysisByPresentationId(presentationId);

		speechDAO.insertHabitAnalysis(presentationId, "음", eumCount);
		speechDAO.insertHabitAnalysis(presentationId, "어", eoCount);
		speechDAO.insertHabitAnalysis(presentationId, "아", ahCount);

		List<SpeechHabitAnalysis> savedAnalysis = speechDAO.selectHabitAnalysisByPresentationId(presentationId);

		int totalFillerCount = 0;
		List<Map<String, Object>> fillerWords = new ArrayList<>();

		for (SpeechHabitAnalysis analysis : savedAnalysis) {
			totalFillerCount += analysis.getFillerCount();

			Map<String, Object> wordMap = new LinkedHashMap<>();
			wordMap.put("word", analysis.getFillerWord());
			wordMap.put("count", analysis.getFillerCount());

			fillerWords.add(wordMap);
		}

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("presentationId", presentationId);
		result.put("totalFillerCount", totalFillerCount);
		result.put("fillerWords", fillerWords);

		return result;
	}

	private List<Map<String, Object>> createFillerWordResult(int eumCount, int eoCount, int ahCount) {
		List<Map<String, Object>> fillerWords = new ArrayList<>();

		Map<String, Object> eum = new LinkedHashMap<>();
		eum.put("word", "음");
		eum.put("count", eumCount);
		fillerWords.add(eum);

		Map<String, Object> eo = new LinkedHashMap<>();
		eo.put("word", "어");
		eo.put("count", eoCount);
		fillerWords.add(eo);

		Map<String, Object> ah = new LinkedHashMap<>();
		ah.put("word", "아");
		ah.put("count", ahCount);
		fillerWords.add(ah);

		return fillerWords;
	}

	private int countExactWord(String text, String targetWord) {
		if (isBlank(text) || isBlank(targetWord)) {
			return 0;
		}

		// 쉼표, 마침표, 느낌표 같은 기호를 공백으로 바꿔서
		// "음," "어." "아!" 도 각각 음/어/아로 세기 위함
		String cleanedText = text.replaceAll("[,.!?;:()\\[\\]{}\"'“”‘’]", " ");
		String[] words = cleanedText.split("\\s+");

		int count = 0;

		for (String word : words) {
			if (targetWord.equals(word)) {
				count++;
			}
		}

		return count;
	}

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}
}