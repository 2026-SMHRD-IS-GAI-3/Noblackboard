package com.airnote.controller;

import java.io.BufferedReader;
import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.common.ApiResponse;
import com.airnote.service.PresentationService;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

// 발표 종료 요청을 받아 발표 종료 시간을 저장하는 컨트롤러
// 판서 시작 방식인 MANUAL, VOICE_START 값을 관리하는 공통 클래스

// 발표 종료 API
// URL:
// POST /api/presentations/end
 
// 지원하는 요청 방식:
// 1) /api/presentations/end?presentationId=1
//2) x-www-form-urlencoded: presentationId=1
//  3) raw JSON: { "presentationId": 1 }

@WebServlet("/api/presentations/end")
public class PresentationEndController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		try {
			Integer presentationId = getPresentationId(request);

			if (presentationId == null || presentationId == 0) {
				response.getWriter().write(gson.toJson(ApiResponse.error("presentationId가 필요합니다.")));
				return;
			}

			boolean success = presentationService.endPresentation(presentationId);

			if (success) {
				JsonObject data = new JsonObject();
				data.addProperty("presentationId", presentationId);

				response.getWriter().write(gson.toJson(ApiResponse.success("발표 종료 성공", data)));
			} else {
				response.getWriter().write(gson.toJson(ApiResponse.error("발표 종료 실패")));
			}

		} catch (Exception e) {
			e.printStackTrace();
			response.getWriter().write(gson.toJson(ApiResponse.error("발표 종료 처리 중 오류가 발생했습니다.")));
		}
	}

	private Integer getPresentationId(HttpServletRequest request) throws IOException {

		String paramValue = request.getParameter("presentationId");

		if (paramValue != null && !paramValue.trim().isEmpty()) {
			return Integer.parseInt(paramValue);
		}

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

		JsonObject json = gson.fromJson(sb.toString(), JsonObject.class);

		if (json != null && json.has("presentationId") && !json.get("presentationId").isJsonNull()) {
			return json.get("presentationId").getAsInt();
		}

		return null;
	}
}