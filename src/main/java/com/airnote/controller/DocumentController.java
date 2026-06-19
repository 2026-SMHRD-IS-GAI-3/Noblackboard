package com.airnote.controller;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import com.airnote.service.DocumentService;
import com.airnote.common.ApiServletSupport;
import com.airnote.util.UploadStorage;
import java.util.LinkedHashMap;
import java.util.Map;

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
		Path savedPath = null;
		boolean keepSavedFile = false;

		try {
			int userId = ApiServletSupport.requirePositiveInt("userId", request.getParameter("userId"));
			int pageCount = ApiServletSupport.requirePositiveInt("pageCount", request.getParameter("pageCount"));

			Part filePart = request.getPart("file");

			if (filePart == null || filePart.getSize() == 0) {
				ApiServletSupport.badRequest(response, "업로드할 PDF 파일이 없습니다.");
				return;
			}

			String originalFileName = getFileName(filePart);

			if (originalFileName == null || originalFileName.trim().isEmpty()) {
				ApiServletSupport.badRequest(response, "파일명이 올바르지 않습니다.");
				return;
			}

			if (!originalFileName.toLowerCase().endsWith(".pdf")) {
				ApiServletSupport.badRequest(response, "PDF 파일만 업로드할 수 있습니다.");
				return;
			}

			String savedFileName = UUID.randomUUID().toString() + "_" + originalFileName;
			savedPath = UploadStorage.directory("pdf").resolve(savedFileName);
			try (InputStream input = filePart.getInputStream()) {
				Files.copy(input, savedPath, StandardCopyOption.REPLACE_EXISTING);
			}

			int pdfId = documentService.savePdfDocument(userId, savedFileName, pageCount);

			if (pdfId > 0) {
				keepSavedFile = true;
				Map<String, Object> data = new LinkedHashMap<>();
				data.put("pdfId", pdfId);
				data.put("fileName", savedFileName);
				data.put("pageCount", pageCount);
				ApiServletSupport.success(response, "PDF 업로드 성공", data);
			} else {
				ApiServletSupport.serverError(response, "PDF 정보 DB 저장 실패");
			}

		} catch (Exception e) {
			e.printStackTrace();

			if (e instanceof IllegalArgumentException) {
				ApiServletSupport.badRequest(response, e.getMessage());
			} else {
				ApiServletSupport.serverError(response, "PDF 업로드 처리 중 오류가 발생했습니다.");
			}
		} finally {
			if (savedPath != null && !keepSavedFile) {
				Files.deleteIfExists(savedPath);
			}
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
