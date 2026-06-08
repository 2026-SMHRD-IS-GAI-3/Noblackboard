package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.service.PresentationService;

@WebServlet("/api/presentations/end")
public class PresentationEndController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		int presentationId = Integer.parseInt(request.getParameter("presentationId"));

		boolean success = presentationService.endPresentation(presentationId);

		if (success) {
			response.getWriter().print("{\"success\":true," + "\"message\":\"발표 종료 성공\","
					+ "\"data\":{\"presentationId\":" + presentationId + "}}");
		} else {
			response.getWriter().print("{\"success\":false," + "\"message\":\"발표 종료 실패\"}");
		}
	}
}