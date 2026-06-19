package com.airnote.controller;

import java.io.IOException;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import com.airnote.common.ApiResponse;
import com.airnote.common.ApiServletSupport;
import com.airnote.model.RecordImage;
import com.airnote.service.RecordService;
import com.google.gson.Gson;

// 발표 화면 캡처 이미지 저장과 저장 이미지 목록 조회를 처리하는 컨트롤러

@WebServlet(urlPatterns = { "/api/records/save-image", "/api/records/images" })
@MultipartConfig(
		fileSizeThreshold = 1024 * 1024,
		maxFileSize = 1024 * 1024 * 50,
		maxRequestSize = 1024 * 1024 * 60)
public class RecordController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private RecordService recordService = new RecordService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		String uri = request.getRequestURI();

		if (uri.endsWith("/api/records/save-image")) {
			saveImage(request, response);
			return;
		}

		response.getWriter().write(gson.toJson(ApiResponse.error("지원하지 않는 POST 요청입니다.")));
	}

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		String uri = request.getRequestURI();

		if (uri.endsWith("/api/records/images")) {
			getImages(request, response);
			return;
		}

		response.getWriter().write(gson.toJson(ApiResponse.error("지원하지 않는 GET 요청입니다.")));
	}

	private void saveImage(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		try {
			String presentationIdStr = request.getParameter("presentationId");
			String pageNoStr = request.getParameter("pageNo");

			if (presentationIdStr == null || presentationIdStr.trim().isEmpty()) {
				ApiServletSupport.badRequest(response, "presentationId가 필요합니다.");
				return;
			}

			if (pageNoStr == null || pageNoStr.trim().isEmpty()) {
				ApiServletSupport.badRequest(response, "pageNo가 필요합니다.");
				return;
			}

			int presentationId = ApiServletSupport.requirePositiveInt("presentationId", presentationIdStr);
			int pageNo = ApiServletSupport.requirePositiveInt("pageNo", pageNoStr);

			Part imagePart = request.getPart("image");

			if (imagePart == null || imagePart.getSize() == 0) {
				ApiServletSupport.badRequest(response, "image 파일이 필요합니다.");
				return;
			}

			RecordImage recordImage = recordService.saveCaptureImage(request.getServletContext(), presentationId,
					pageNo, imagePart);

			if (recordImage == null) {
				ApiServletSupport.serverError(response, "이미지 저장 실패");
				return;
			}

			ApiServletSupport.success(response, "발표 화면 이미지 저장 성공", recordImage);

		} catch (Exception e) {
			e.printStackTrace();
			if (e instanceof IllegalArgumentException) {
				ApiServletSupport.badRequest(response, e.getMessage());
			} else {
				ApiServletSupport.serverError(response, "이미지 저장 처리 중 오류가 발생했습니다.");
			}
		}
	}

	private void getImages(HttpServletRequest request, HttpServletResponse response) throws IOException {

		try {
			String presentationIdStr = request.getParameter("presentationId");

			if (presentationIdStr == null || presentationIdStr.trim().isEmpty()) {
				ApiServletSupport.badRequest(response, "presentationId가 필요합니다.");
				return;
			}

			int presentationId = ApiServletSupport.requirePositiveInt("presentationId", presentationIdStr);

			List<RecordImage> images = recordService.getImagesByPresentationId(presentationId);

			ApiServletSupport.success(response, "저장 이미지 목록 조회 성공", images);

		} catch (Exception e) {
			e.printStackTrace();
			if (e instanceof IllegalArgumentException) {
				ApiServletSupport.badRequest(response, e.getMessage());
			} else {
				ApiServletSupport.serverError(response, "저장 이미지 목록 조회 중 오류가 발생했습니다.");
			}
		}
	}
}
