package com.airnote.controller;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.Presentation;
import com.airnote.service.PresentationService;

@WebServlet("/api/presentations")
public class PresentationListController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		int userId = Integer.parseInt(request.getParameter("userId"));

		List<Presentation> list = presentationService.getPresentationList(userId);

		SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

		StringBuilder json = new StringBuilder();

		json.append("{");
		json.append("\"success\":true,");
		json.append("\"message\":\"발표 기록 목록 조회 성공\",");
		json.append("\"data\":[");

		for (int i = 0; i < list.size(); i++) {
			Presentation p = list.get(i);

			String startTime = p.getStartTime() == null ? "" : sdf.format(p.getStartTime());
			String endTime = p.getEndTime() == null ? "" : sdf.format(p.getEndTime());

			json.append("{");
			json.append("\"presentationId\":").append(p.getPresentationId()).append(",");
			json.append("\"userId\":").append(p.getUserId()).append(",");
			json.append("\"pdfId\":").append(p.getPdfId()).append(",");
			json.append("\"startTime\":\"").append(startTime).append("\",");
			json.append("\"endTime\":\"").append(endTime).append("\"");
			json.append("}");

			if (i < list.size() - 1) {
				json.append(",");
			}
		}

		json.append("]");
		json.append("}");

		response.getWriter().print(json.toString());
	}
}