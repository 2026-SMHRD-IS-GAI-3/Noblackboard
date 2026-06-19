package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.common.ApiResponse;
import com.airnote.common.ApiServletSupport;
import com.airnote.model.Presentation;
import com.airnote.service.PresentationService;
import com.google.gson.Gson;

// 특정 발표의 상세 정보와 저장 이미지 목록을 함께 조회하는 컨트롤러

@WebServlet("/api/presentations/detail")
public class PresentationDetailController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();
	private Gson gson = new Gson();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		try {
			String presentationIdStr = request.getParameter("presentationId");

			if (presentationIdStr == null || presentationIdStr.trim().isEmpty()) {
				ApiServletSupport.badRequest(response, "presentationId가 필요합니다.");
				return;
			}

			int presentationId = ApiServletSupport.requirePositiveInt("presentationId", presentationIdStr);

			Presentation presentation = presentationService.getPresentationDetail(presentationId);

			if (presentation == null) {
				ApiServletSupport.notFound(response, "발표 정보를 찾을 수 없습니다.");
				return;
			}

			ApiServletSupport.success(response, "발표 상세 조회 성공", presentation);

		} catch (IllegalArgumentException e) {
			ApiServletSupport.badRequest(response, e.getMessage());
		} catch (Exception e) {
			e.printStackTrace();
			ApiServletSupport.serverError(response, "발표 상세 조회 중 DB 오류가 발생했습니다.");
		}
	}
}
