package com.airnote.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.util.UploadStorage;

@WebServlet("/api/records/files/*")
public class RecordFileController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {
		String pathInfo = request.getPathInfo();
		String fileName = pathInfo == null ? "" : pathInfo.replaceFirst("^/", "");
		Path file;

		try {
			file = UploadStorage.recordImage(fileName);
		} catch (IOException e) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST);
			return;
		}

		if (!Files.isRegularFile(file)) {
			response.sendError(HttpServletResponse.SC_NOT_FOUND);
			return;
		}

		String contentType = Files.probeContentType(file);
		response.setContentType(contentType == null ? "application/octet-stream" : contentType);
		response.setContentLengthLong(Files.size(file));
		Files.copy(file, response.getOutputStream());
	}
}
