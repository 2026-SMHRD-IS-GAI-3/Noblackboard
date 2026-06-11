package com.airnote.controller;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.service.SpeechService;
import com.google.gson.Gson;

@WebServlet(urlPatterns = { "/api/speech/logs", "/api/speech/analyze" })
public class SpeechController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private SpeechService speechService = new SpeechService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		// 중요: request body 읽기 전에 UTF-8 설정
		request.setCharacterEncoding("UTF-8");
		setJsonResponse(response);

		String path = request.getServletPath();

		if ("/api/speech/logs".equals(path)) {
			saveSpeechLog(request, response);
			return;
		}

		if ("/api/speech/analyze".equals(path)) {
			analyzeSpeechHabit(request, response);
			return;
		}

		writeJson(response, false, "지원하지 않는 요청입니다.", null);
	}

	private void saveSpeechLog(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			String body = readBody(request);

			SpeechLogRequest speechRequest = null;

			if (!isBlank(body)) {
				speechRequest = gson.fromJson(body, SpeechLogRequest.class);
			}

			int presentationId = 0;
			int pageNo = 0;
			String speechText = null;

			if (speechRequest != null) {
				presentationId = speechRequest.getPresentationId();
				pageNo = speechRequest.getPageNo();
				speechText = speechRequest.getSpeechText();
			}

			if (presentationId <= 0) {
				presentationId = parseInt(request.getParameter("presentationId"));
			}

			if (pageNo <= 0) {
				pageNo = parseInt(request.getParameter("pageNo"));
			}

			if (isBlank(speechText)) {
				speechText = request.getParameter("speechText");
			}

			int speechLogId = speechService.saveSpeechLog(presentationId, pageNo, speechText);

			if (speechLogId > 0) {
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("speechLogId", speechLogId);

				writeJson(response, true, "음성 로그 저장 성공", data);
			} else {
				writeJson(response, false, "음성 로그 저장 실패", null);
			}

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 음성 로그 저장 실패", null);
		}
	}

	private void analyzeSpeechHabit(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			String body = readBody(request);

			SpeechAnalyzeRequest analyzeRequest = null;

			if (!isBlank(body)) {
				analyzeRequest = gson.fromJson(body, SpeechAnalyzeRequest.class);
			}

			int presentationId = 0;

			if (analyzeRequest != null) {
				presentationId = analyzeRequest.getPresentationId();
			}

			if (presentationId <= 0) {
				presentationId = parseInt(request.getParameter("presentationId"));
			}

			Map<String, Object> data = speechService.analyzeSpeechHabit(presentationId);

			if (data != null) {
				writeJson(response, true, "음성 습관 분석 성공", data);
			} else {
				writeJson(response, false, "음성 습관 분석 실패", null);
			}

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 음성 습관 분석 실패", null);
		}
	}

	private String readBody(HttpServletRequest request) throws IOException {
		StringBuilder sb = new StringBuilder();

		BufferedReader reader = request.getReader();
		String line;

		while ((line = reader.readLine()) != null) {
			sb.append(line);
		}

		return sb.toString();
	}

	private void setJsonResponse(HttpServletResponse response) {
		response.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");
	}

	private void writeJson(HttpServletResponse response, boolean success, String message, Object data)
			throws IOException {
		Map<String, Object> result = new LinkedHashMap<>();
		result.put("success", success);
		result.put("message", message);

		if (data != null) {
			result.put("data", data);
		}

		response.getWriter().write(gson.toJson(result));
	}

	private int parseInt(String value) {
		try {
			if (isBlank(value)) {
				return 0;
			}
			return Integer.parseInt(value);
		} catch (Exception e) {
			return 0;
		}
	}

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}

	private static class SpeechLogRequest {
		private int presentationId;
		private int pageNo;
		private String speechText;

		public int getPresentationId() {
			return presentationId;
		}

		public int getPageNo() {
			return pageNo;
		}

		public String getSpeechText() {
			return speechText;
		}
	}

	private static class SpeechAnalyzeRequest {
		private int presentationId;

		public int getPresentationId() {
			return presentationId;
		}
	}
}