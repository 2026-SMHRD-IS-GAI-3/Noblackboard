package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.Annotation;
import com.airnote.service.AnnotationService;

// 밑줄, 형광펜, 포인터 같은 판서 기록을 저장하는 컨트롤러

@WebServlet("/api/annotations")
public class AnnotationController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private AnnotationService annotationService = new AnnotationService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		Annotation annotation = new Annotation();

		annotation.setPresentationId(Integer.parseInt(request.getParameter("presentationId")));
		annotation.setPageNo(Integer.parseInt(request.getParameter("pageNo")));
		annotation.setToolType(request.getParameter("toolType"));
		annotation.setColor(request.getParameter("color"));
		annotation.setStartX(Double.parseDouble(request.getParameter("startX")));
		annotation.setStartY(Double.parseDouble(request.getParameter("startY")));
		annotation.setEndX(Double.parseDouble(request.getParameter("endX")));
		annotation.setEndY(Double.parseDouble(request.getParameter("endY")));
		annotation.setSourceType(request.getParameter("sourceType"));

		// VOICE_START일 때 들어오는 값
		// MANUAL일 때는 비워도 null로 처리됨
		annotation.setAnchorId(getIntegerOrNull(request, "anchorId"));
		annotation.setMatchLogId(getIntegerOrNull(request, "matchLogId"));
		annotation.setMatchConfidence(getDoubleOrNull(request, "matchConfidence"));

		int annotationId = annotationService.saveAnnotation(annotation);

		if (annotationId > 0) {
			response.getWriter().print("{\"success\":true," + "\"message\":\"판서 기록 저장 성공\","
					+ "\"data\":{\"annotationId\":" + annotationId + "}}");
		} else {
			response.getWriter().print("{\"success\":false," + "\"message\":\"판서 기록 저장 실패\"}");
		}
	}

	private Integer getIntegerOrNull(HttpServletRequest request, String name) {
		String value = request.getParameter(name);

		if (value == null || value.trim().isEmpty()) {
			return null;
		}

		return Integer.parseInt(value);
	}

	private Double getDoubleOrNull(HttpServletRequest request, String name) {
		String value = request.getParameter(name);

		if (value == null || value.trim().isEmpty()) {
			return null;
		}

		return Double.parseDouble(value);
	}
}