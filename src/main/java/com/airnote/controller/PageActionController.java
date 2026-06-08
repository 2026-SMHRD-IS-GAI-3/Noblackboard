package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.PageAction;
import com.airnote.service.PageActionService;

@WebServlet("/api/page-actions")
public class PageActionController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PageActionService pageActionService = new PageActionService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		PageAction pageAction = new PageAction();

		pageAction.setPresentationId(Integer.parseInt(request.getParameter("presentationId")));
		pageAction.setFromPageNo(Integer.parseInt(request.getParameter("fromPageNo")));
		pageAction.setToPageNo(Integer.parseInt(request.getParameter("toPageNo")));
		pageAction.setActionType(request.getParameter("actionType"));

		int pageActionId = pageActionService.savePageAction(pageAction);

		if (pageActionId > 0) {
			response.getWriter().print("{\"success\":true," + "\"message\":\"페이지 이동 기록 저장 성공\","
					+ "\"data\":{\"pageActionId\":" + pageActionId + "}}");
		} else {
			response.getWriter().print("{\"success\":false," + "\"message\":\"페이지 이동 기록 저장 실패\"}");
		}
	}
}