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

import com.airnote.model.SlideViewLog;
import com.airnote.service.SlideViewService;
import com.google.gson.Gson;

@WebServlet(urlPatterns = { "/api/slide-views/start", "/api/slide-views/end" })
public class SlideViewController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private SlideViewService slideViewService = new SlideViewService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		setJsonResponse(response);

		String path = request.getServletPath();

		if ("/api/slide-views/start".equals(path)) {
			startSlideView(request, response);
			return;
		}

		if ("/api/slide-views/end".equals(path)) {
			endSlideView(request, response);
			return;
		}

		writeJson(response, false, "지원하지 않는 요청입니다.", null);
	}

	private void startSlideView(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			String body = readBody(request);

			StartSlideViewRequest startRequest = null;

			if (!isBlank(body)) {
				startRequest = gson.fromJson(body, StartSlideViewRequest.class);
			}

			int presentationId = 0;
			int pageNo = 0;

			if (startRequest != null) {
				presentationId = startRequest.getPresentationId();
				pageNo = startRequest.getPageNo();
			}

			// Postman에서 form-data나 x-www-form-urlencoded로 테스트할 때도 작동하게 예비 처리
			if (presentationId <= 0) {
				presentationId = parseInt(request.getParameter("presentationId"));
			}

			if (pageNo <= 0) {
				pageNo = parseInt(request.getParameter("pageNo"));
			}

			int slideViewId = slideViewService.startSlideView(presentationId, pageNo);

			if (slideViewId > 0) {
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("slideViewId", slideViewId);

				writeJson(response, true, "슬라이드 진입 기록 성공", data);
			} else {
				writeJson(response, false, "슬라이드 진입 기록 실패", null);
			}

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 슬라이드 진입 기록 실패", null);
		}
	}

	private void endSlideView(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			String body = readBody(request);

			EndSlideViewRequest endRequest = null;

			if (!isBlank(body)) {
				endRequest = gson.fromJson(body, EndSlideViewRequest.class);
			}

			int slideViewId = 0;

			if (endRequest != null) {
				slideViewId = endRequest.getSlideViewId();
			}

			// Postman에서 form-data나 x-www-form-urlencoded로 테스트할 때도 작동하게 예비 처리
			if (slideViewId <= 0) {
				slideViewId = parseInt(request.getParameter("slideViewId"));
			}

			SlideViewLog log = slideViewService.endSlideView(slideViewId);

			if (log != null) {
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("slideViewId", log.getSlideViewId());
				data.put("durationSec", log.getDurationSec());

				writeJson(response, true, "슬라이드 이탈 기록 성공", data);
			} else {
				writeJson(response, false, "종료할 슬라이드 진입 기록이 없거나 이미 종료된 기록입니다.", null);
			}

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 슬라이드 이탈 기록 실패", null);
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

	private static class StartSlideViewRequest {
		private int presentationId;
		private int pageNo;

		public int getPresentationId() {
			return presentationId;
		}

		public int getPageNo() {
			return pageNo;
		}
	}

	private static class EndSlideViewRequest {
		private int slideViewId;

		public int getSlideViewId() {
			return slideViewId;
		}
	}
}