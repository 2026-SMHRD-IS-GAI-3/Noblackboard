package com.airnote.controller;

import java.io.BufferedReader;
import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.common.ApiResponse;
import com.airnote.model.Presentation;
import com.airnote.service.PresentationService;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

// 발표 시작 요청을 받아 새 발표 세션을 생성하는 컨트롤러

@WebServlet("/api/presentations/start")
public class PresentationController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		try {
			JsonObject json = readJson(request);

			int userId = 0;
			int pdfId = 0;

			if (json != null && json.has("userId") && !json.get("userId").isJsonNull()) {
				userId = json.get("userId").getAsInt();
			} else if (request.getParameter("userId") != null) {
				userId = Integer.parseInt(request.getParameter("userId"));
			}

			if (json != null && json.has("pdfId") && !json.get("pdfId").isJsonNull()) {
				pdfId = json.get("pdfId").getAsInt();
			} else if (request.getParameter("pdfId") != null) {
				pdfId = Integer.parseInt(request.getParameter("pdfId"));
			}

			if (userId == 0 || pdfId == 0) {
				response.getWriter().write(gson.toJson(ApiResponse.error("userId와 pdfId가 필요합니다.")));
				return;
			}

			Presentation presentation = presentationService.startPresentation(userId, pdfId);

			if (presentation == null) {
				response.getWriter().write(gson.toJson(ApiResponse.error("발표 시작 실패")));
				return;
			}

			response.getWriter().write(gson.toJson(ApiResponse.success("발표 시작 성공", presentation)));

		} catch (Exception e) {
			e.printStackTrace();
			response.getWriter().write(gson.toJson(ApiResponse.error("발표 시작 처리 중 오류가 발생했습니다.")));
		}
	}

	private JsonObject readJson(HttpServletRequest request) throws IOException {

		StringBuilder sb = new StringBuilder();
		String line;

		try (BufferedReader br = request.getReader()) {
			while ((line = br.readLine()) != null) {
				sb.append(line);
			}
		}

		if (sb.length() == 0) {
			return null;
		}

		return gson.fromJson(sb.toString(), JsonObject.class);
	}
}