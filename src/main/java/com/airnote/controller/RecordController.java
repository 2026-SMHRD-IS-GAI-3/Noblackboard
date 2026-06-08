package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import com.airnote.common.ApiResponse;
import com.airnote.model.RecordImage;
import com.airnote.service.RecordService;

@WebServlet("/api/records/save-image")
@MultipartConfig(fileSizeThreshold = 1024 * 1024, maxFileSize = 1024 * 1024 * 10, maxRequestSize = 1024 * 1024 * 20)
public class RecordController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private RecordService recordService = new RecordService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		try {
			// 1. 프론트/Postman에서 보낸 값 꺼내기
			String presentationIdText = request.getParameter("presentationId");
			String pageNoText = request.getParameter("pageNo");

			// 2. 필수값 검사
			if (isBlank(presentationIdText)) {
				writeJson(response, ApiResponse.fail("presentationId가 없습니다"));
				return;
			}

			if (isBlank(pageNoText)) {
				writeJson(response, ApiResponse.fail("pageNo가 없습니다"));
				return;
			}

			// 3. 숫자로 변환
			int presentationId = Integer.parseInt(presentationIdText);
			int pageNo = Integer.parseInt(pageNoText);

			// 4. 이미지 파일 꺼내기
			Part imagePart = request.getPart("image");

			if (imagePart == null || imagePart.getSize() == 0) {
				writeJson(response, ApiResponse.fail("저장할 캡처 이미지가 없습니다"));
				return;
			}

			// 5. 서비스에게 이미지 저장 + DB 저장 요청
			RecordImage recordImage = recordService.saveCaptureImage(getServletContext(), presentationId, pageNo,
					imagePart);

			// 6. 응답 data 만들기
			String dataJson = makeRecordImageJson(recordImage);

			// 7. 성공 응답
			writeJson(response, ApiResponse.success("발표 화면 이미지 저장 성공", dataJson));

		} catch (NumberFormatException e) {
			writeJson(response, ApiResponse.fail("presentationId 또는 pageNo는 숫자여야 합니다"));

		} catch (IllegalStateException e) {
			e.printStackTrace();
			writeJson(response, ApiResponse.fail("업로드 가능한 파일 크기를 초과했습니다"));

		} catch (Exception e) {
			e.printStackTrace();
			writeJson(response, ApiResponse.fail("발표 화면 이미지 저장 실패"));
		}
	}

	private String makeRecordImageJson(RecordImage recordImage) {
		return "{" + "\"recordImageId\":" + recordImage.getRecordImageId() + "," + "\"presentationId\":"
				+ recordImage.getPresentationId() + "," + "\"pageNo\":" + recordImage.getPageNo() + ","
				+ "\"imageUrl\":\"" + ApiResponse.escape(recordImage.getImageUrl()) + "\"," + "\"savedFileName\":\""
				+ ApiResponse.escape(recordImage.getSavedFileName()) + "\"," + "\"fileSize\":"
				+ recordImage.getFileSize() + "}";
	}

	private void writeJson(HttpServletResponse response, String json) throws IOException {
		response.getWriter().write(json);
	}

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}
}