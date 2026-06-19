package com.airnote.controller;

import java.io.IOException;
import java.util.List;

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

// 사용자별 발표 기록 목록을 조회하는 컨트롤러

@WebServlet("/api/presentations")
public class PresentationListController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();
	private Gson gson = new Gson();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		try {
			String userIdStr = request.getParameter("userId");

			if (userIdStr == null || userIdStr.trim().isEmpty()) {
				ApiServletSupport.badRequest(response, "userId가 필요합니다.");
				return;
			}

			int userId = ApiServletSupport.requirePositiveInt("userId", userIdStr);

			List<Presentation> presentationList = presentationService.getPresentationList(userId);

			ApiServletSupport.success(response, "발표 목록 조회 성공", presentationList);

		} catch (IllegalArgumentException e) {
			ApiServletSupport.badRequest(response, e.getMessage());
		} catch (Exception e) {
			e.printStackTrace();
			ApiServletSupport.serverError(response, "발표 목록 조회 중 DB 오류가 발생했습니다.");
		}
	}
}
