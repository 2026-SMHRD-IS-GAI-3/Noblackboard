package com.airnote.controller;

import java.io.File;
import java.io.IOException;
import java.util.UUID;

import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import com.airnote.service.DocumentService;

// PDF 업로드 요청을 받아 문서 정보를 저장하는 API 컨트롤러

@WebServlet("/api/documents/upload")
@MultipartConfig(fileSizeThreshold = 1024 * 1024, maxFileSize = 1024 * 1024 * 50, maxRequestSize = 1024 * 1024 * 60)
public class DocumentController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private DocumentService documentService = new DocumentService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		try {
			int userId = Integer.parseInt(request.getParameter("userId"));

			Integer pageCount = null;
			String pageCountValue = request.getParameter("pageCount");

			if (pageCountValue != null && !pageCountValue.trim().isEmpty()) {
				pageCount = Integer.parseInt(pageCountValue);
			}

			Part filePart = request.getPart("file");

			if (filePart == null || filePart.getSize() == 0) {
				response.getWriter().print("{\"success\":false," + "\"message\":\"업로드할 PDF 파일이 없습니다\"}");
				return;
			}

			String originalFileName = getFileName(filePart);

			if (originalFileName == null || originalFileName.trim().isEmpty()) {
				response.getWriter().print("{\"success\":false," + "\"message\":\"파일명이 올바르지 않습니다\"}");
				return;
			}

			if (!originalFileName.toLowerCase().endsWith(".pdf")) {
				response.getWriter().print("{\"success\":false," + "\"message\":\"PDF 파일만 업로드할 수 있습니다\"}");
				return;
			}

			String uploadPath = request.getServletContext().getRealPath("/uploads/pdf");

			File uploadDir = new File(uploadPath);

			if (!uploadDir.exists()) {
				uploadDir.mkdirs();
			}

			String savedFileName = UUID.randomUUID().toString() + "_" + originalFileName;
			String savedPath = uploadPath + File.separator + savedFileName;

			filePart.write(savedPath);

			int pdfId = documentService.savePdfDocument(userId, savedFileName, pageCount);

			if (pdfId > 0) {
				response.getWriter()
						.print("{\"success\":true," + "\"message\":\"PDF 업로드 성공\"," + "\"data\":{" + "\"pdfId\":"
								+ pdfId + "," + "\"fileName\":\"" + savedFileName + "\"," + "\"pageCount\":"
								+ (pageCount == null ? "null" : pageCount) + "}}");
			} else {
				response.getWriter().print("{\"success\":false," + "\"message\":\"PDF 정보 DB 저장 실패\"}");
			}

		} catch (Exception e) {
			e.printStackTrace();

			response.getWriter().print("{\"success\":false," + "\"message\":\"PDF 업로드 처리 중 오류 발생\"}");
		}
	}

	private String getFileName(Part part) {
		String contentDisposition = part.getHeader("content-disposition");

		if (contentDisposition == null) {
			return null;
		}

		String[] items = contentDisposition.split(";");

		for (String item : items) {
			if (item.trim().startsWith("filename")) {
				String fileName = item.substring(item.indexOf("=") + 1).trim().replace("\"", "");
				return new File(fileName).getName();
			}
		}

		return null;
	}
}