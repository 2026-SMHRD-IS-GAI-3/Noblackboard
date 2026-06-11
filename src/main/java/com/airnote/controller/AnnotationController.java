package com.airnote.controller;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.Annotation;
import com.airnote.service.AnnotationService;
import com.google.gson.Gson;

@WebServlet(urlPatterns = { "/api/annotations", "/api/annotations/delete" })
public class AnnotationController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private AnnotationService annotationService = new AnnotationService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		setJsonResponse(response);

		String path = request.getServletPath();

		if ("/api/annotations/delete".equals(path)) {
			deleteAnnotation(request, response);
			return;
		}

		saveAnnotation(request, response);
	}

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		setJsonResponse(response);

		String presentationIdStr = request.getParameter("presentationId");

		if (isBlank(presentationIdStr)) {
			writeJson(response, false, "presentationId가 필요합니다.", null);
			return;
		}

		try {
			int presentationId = Integer.parseInt(presentationIdStr);

			List<Annotation> annotations = annotationService.getAnnotationList(presentationId);

			Map<String, Object> data = new LinkedHashMap<>();
			data.put("presentationId", presentationId);
			data.put("annotations", annotations);

			writeJson(response, true, "판서 목록 조회 성공", data);

		} catch (NumberFormatException e) {
			writeJson(response, false, "presentationId는 숫자여야 합니다.", null);
		}
	}

	private void saveAnnotation(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			String body = readBody(request);

			Annotation annotation = null;

			if (!isBlank(body)) {
				annotation = gson.fromJson(body, Annotation.class);
			}

			if (annotation == null) {
				annotation = new Annotation();
				annotation.setPresentationId(parseInt(request.getParameter("presentationId")));
				annotation.setPageNo(parseInt(request.getParameter("pageNo")));
				annotation.setToolType(request.getParameter("toolType"));
				annotation.setColor(request.getParameter("color"));
				annotation.setStartX(parseDouble(request.getParameter("startX")));
				annotation.setStartY(parseDouble(request.getParameter("startY")));
				annotation.setEndX(parseDouble(request.getParameter("endX")));
				annotation.setEndY(parseDouble(request.getParameter("endY")));
				annotation.setAnchorId(parseInt(request.getParameter("anchorId")));
				annotation.setMatchLogId(parseInt(request.getParameter("matchLogId")));
				annotation.setSourceType(request.getParameter("sourceType"));
				annotation.setMatchConfidence(parseDouble(request.getParameter("matchConfidence")));
			}

			int annotationId = annotationService.saveAnnotation(annotation);

			if (annotationId > 0) {
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("annotationId", annotationId);

				writeJson(response, true, "판서 기록 저장 성공", data);
			} else {
				writeJson(response, false, "판서 기록 저장 실패", null);
			}

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 판서 저장 실패", null);
		}
	}

	private void deleteAnnotation(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			String body = readBody(request);

			DeleteAnnotationRequest deleteRequest = null;

			if (!isBlank(body)) {
				deleteRequest = gson.fromJson(body, DeleteAnnotationRequest.class);
			}

			int annotationId = 0;
			int presentationId = 0;
			String deleteType = null;

			if (deleteRequest != null) {
				annotationId = deleteRequest.getAnnotationId();
				presentationId = deleteRequest.getPresentationId();
				deleteType = deleteRequest.getDeleteType();
			}

			// 혹시 form-data나 x-www-form-urlencoded로 테스트할 때도 작동하게 예비 처리
			if (annotationId <= 0) {
				annotationId = parseInt(request.getParameter("annotationId"));
			}

			if (presentationId <= 0) {
				presentationId = parseInt(request.getParameter("presentationId"));
			}

			if (isBlank(deleteType)) {
				deleteType = request.getParameter("deleteType");
			}

			boolean success = annotationService.deleteAnnotation(annotationId, presentationId, deleteType);

			if (success) {
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("annotationId", annotationId);

				writeJson(response, true, "판서 삭제 처리 성공", data);
			} else {
				writeJson(response, false, "삭제할 판서가 없거나 이미 삭제 처리된 판서입니다.", null);
			}

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, false, "서버 오류로 판서 삭제 처리 실패", null);
		}
	}

	private String readBody(HttpServletRequest request) throws IOException {
		StringBuilder sb = new StringBuilder();

		BufferedReader reader = request.getReader();
		String line;

		while ((line = reader.readLine()) != null) {
			sb.append(line);
		}

		return sb.toString();
	}

	private void setJsonResponse(HttpServletResponse response) {
		response.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");
	}

	private void writeJson(HttpServletResponse response, boolean success, String message, Object data)
			throws IOException {
		Map<String, Object> result = new LinkedHashMap<>();
		result.put("success", success);
		result.put("message", message);

		if (data != null) {
			result.put("data", data);
		}

		response.getWriter().write(gson.toJson(result));
	}

	private int parseInt(String value) {
		try {
			if (isBlank(value)) {
				return 0;
			}
			return Integer.parseInt(value);
		} catch (Exception e) {
			return 0;
		}
	}

	private double parseDouble(String value) {
		try {
			if (isBlank(value)) {
				return 0;
			}
			return Double.parseDouble(value);
		} catch (Exception e) {
			return 0;
		}
	}

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}

	private static class DeleteAnnotationRequest {
		private int annotationId;
		private int presentationId;
		private String deleteType;

		public int getAnnotationId() {
			return annotationId;
		}

		public int getPresentationId() {
			return presentationId;
		}

		public String getDeleteType() {
			return deleteType;
		}
	}
}