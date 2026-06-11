package com.airnote.controller;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.PresentationReport;
import com.airnote.service.ReportService;
import com.google.gson.Gson;

@WebServlet("/api/reports/presentation")
public class ReportController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private ReportService reportService = new ReportService();
	private Gson gson = new Gson();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		setJsonResponse(response);

		String presentationIdStr = request.getParameter("presentationId");

		if (isBlank(presentationIdStr)) {
			writeJson(response, false, "presentationId가 필요합니다.", null);
			return;
		}

		try {
			int presentationId = Integer.parseInt(presentationIdStr);

			PresentationReport report = reportService.getPresentationReport(presentationId);

			if (report == null) {
				writeJson(response, false, "발표 리포트 조회 실패", null);
				return;
			}

			writeJson(response, true, "발표 리포트 조회 성공", report);

		} catch (NumberFormatException e) {
			writeJson(response, false, "presentationId는 숫자여야 합니다.", null);
		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 발표 리포트 조회 실패", null);
		}
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

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}
}