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
import com.airnote.common.ApiServletSupport;

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
			int presentationId = ApiServletSupport.requirePositiveInt("presentationId", presentationIdStr);

			List<Annotation> annotations = annotationService.getAnnotationList(presentationId);

			Map<String, Object> data = new LinkedHashMap<>();
			data.put("presentationId", presentationId);
			data.put("annotations", annotations);

			writeJson(response, true, "판서 목록 조회 성공", data);

		} catch (IllegalArgumentException e) {
			ApiServletSupport.badRequest(response, e.getMessage());
		} catch (Exception e) {
			e.printStackTrace();
			ApiServletSupport.serverError(response, "판서 목록 조회 중 DB 오류가 발생했습니다.");
		}
	}

	private void saveAnnotation(HttpServletRequest request, HttpServletResponse response) throws IOException {
		try {
			Annotation annotation = null;
			String contentType = request.getContentType();
			if (contentType != null && contentType.toLowerCase().startsWith("application/json")) {
				annotation = ApiServletSupport.readJson(request, Annotation.class);
			}

			if (annotation == null) {
				annotation = new Annotation();
				annotation.setPresentationId(parseRequiredInt("presentationId", request.getParameter("presentationId")));
				annotation.setPageNo(parseRequiredInt("pageNo", request.getParameter("pageNo")));
				annotation.setToolType(request.getParameter("toolType"));
				annotation.setColor(request.getParameter("color"));
				annotation.setStartX(parseRequiredDouble("startX", request.getParameter("startX")));
				annotation.setStartY(parseRequiredDouble("startY", request.getParameter("startY")));
				annotation.setEndX(parseRequiredDouble("endX", request.getParameter("endX")));
				annotation.setEndY(parseRequiredDouble("endY", request.getParameter("endY")));
				annotation.setAnchorId(parseOptionalInteger("anchorId", request.getParameter("anchorId")));
				annotation.setSourceType(request.getParameter("sourceType"));
				annotation.setMatchConfidence(parseOptionalDouble("matchConfidence",
						request.getParameter("matchConfidence")));
			}

			int annotationId = annotationService.saveAnnotation(annotation);

			if (annotationId > 0) {
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("annotationId", annotationId);

				writeJson(response, true, "판서 기록 저장 성공", data);
			} else {
				writeJson(response, false, "판서 기록 저장 실패", null);
			}

		} catch (IllegalArgumentException e) {
			ApiServletSupport.badRequest(response, e.getMessage());
		} catch (Exception e) {
			e.printStackTrace();
			ApiServletSupport.serverError(response, "서버 오류로 판서 저장에 실패했습니다.");
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
				annotationId = parseRequiredInt("annotationId", request.getParameter("annotationId"));
			}

			if (presentationId <= 0) {
				presentationId = parseRequiredInt("presentationId", request.getParameter("presentationId"));
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

		} catch (IllegalArgumentException e) {
			ApiServletSupport.badRequest(response, e.getMessage());
		} catch (Exception e) {
			e.printStackTrace();
			ApiServletSupport.serverError(response, "서버 오류로 판서 삭제 처리에 실패했습니다.");
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
		if (success) {
			ApiServletSupport.success(response, message, data);
		} else {
			ApiServletSupport.badRequest(response, message);
		}
	}

	private int parseRequiredInt(String name, String value) {
		return ApiServletSupport.requirePositiveInt(name, value);
	}

	private double parseRequiredDouble(String name, String value) {
		if (isBlank(value)) {
			throw new IllegalArgumentException(name + "가 필요합니다.");
		}
		try {
			return Double.parseDouble(value);
		} catch (NumberFormatException e) {
			throw new IllegalArgumentException(name + "는 숫자여야 합니다.");
		}
	}

	private Integer parseOptionalInteger(String name, String value) {
		if (isBlank(value)) {
			return null;
		}
		try {
			return Integer.valueOf(value);
		} catch (NumberFormatException error) {
			throw new IllegalArgumentException(name + "는 숫자여야 합니다.");
		}
	}

	private Double parseOptionalDouble(String name, String value) {
		if (isBlank(value)) {
			return null;
		}
		try {
			return Double.valueOf(value);
		} catch (NumberFormatException error) {
			throw new IllegalArgumentException(name + "는 숫자여야 합니다.");
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
