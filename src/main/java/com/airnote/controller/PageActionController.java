package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.PageAction;
import com.airnote.service.PageActionService;
import com.airnote.common.ApiServletSupport;
import java.util.LinkedHashMap;
import java.util.Map;

// 다음,이전 페이지 이동 기록을 저장하는 컨트롤러

@WebServlet("/api/page-actions")
public class PageActionController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PageActionService pageActionService = new PageActionService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		try {
			PageAction pageAction = new PageAction();
			pageAction.setPresentationId(ApiServletSupport.requirePositiveInt("presentationId",
					request.getParameter("presentationId")));
			pageAction.setFromPageNo(ApiServletSupport.requirePositiveInt("fromPageNo",
					request.getParameter("fromPageNo")));
			pageAction.setToPageNo(ApiServletSupport.requirePositiveInt("toPageNo",
					request.getParameter("toPageNo")));
			pageAction.setActionType(request.getParameter("actionType"));
			int pageActionId = pageActionService.savePageAction(pageAction);
			if (pageActionId <= 0) {
				ApiServletSupport.badRequest(response, "페이지 이동 값이 올바르지 않습니다.");
				return;
			}
			Map<String, Object> data = new LinkedHashMap<>();
			data.put("pageActionId", pageActionId);
			ApiServletSupport.success(response, "페이지 이동 기록 저장 성공", data);
		} catch (IllegalArgumentException error) {
			ApiServletSupport.badRequest(response, error.getMessage());
		} catch (Exception error) {
			error.printStackTrace();
			ApiServletSupport.serverError(response, "페이지 이동 기록 저장 중 오류가 발생했습니다.");
		}
	}
}
