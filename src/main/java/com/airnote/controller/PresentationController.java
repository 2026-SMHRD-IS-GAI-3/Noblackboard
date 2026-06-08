package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.service.PresentationService;

@WebServlet("/api/presentations/start")
public class PresentationController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		int userId = Integer.parseInt(request.getParameter("userId"));
		int pdfId = Integer.parseInt(request.getParameter("pdfId"));

		int presentationId = presentationService.startPresentation(userId, pdfId);

		if (presentationId > 0) {
			response.getWriter().print("{\"success\":true," + "\"message\":\"발표 시작 성공\","
					+ "\"data\":{\"presentationId\":" + presentationId + "}}");
		} else {
			response.getWriter().print("{\"success\":false," + "\"message\":\"발표 시작 실패\"}");
		}
	}
}