package com.airnote.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.common.ApiServletSupport;
import com.airnote.util.DBUtil;
import com.airnote.util.UploadStorage;

@WebServlet("/api/health")
public class HealthController extends HttpServlet {
	private static final long serialVersionUID = 1L;
	private static final List<String> REQUIRED_SEQUENCES = Arrays.asList(
			"SEQ_USER_ID",
			"SEQ_PDF_ID",
			"SEQ_PRESENTATION_ID",
			"SEQ_ANNOTATION_ID",
			"SEQ_PAGE_ACTION_ID",
			"SEQ_RECORD_IMAGE");

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
		Map<String, Object> data = new LinkedHashMap<>();
		data.put("buildVersion", "2026-06-12");

		try (Connection connection = DBUtil.getConnection()) {
			data.put("database", "ok");
			Map<String, Boolean> sequences = new LinkedHashMap<>();
			for (String sequence : REQUIRED_SEQUENCES) {
				sequences.put(sequence, sequenceExists(connection, sequence));
			}
			data.put("sequences", sequences);
			if (sequences.containsValue(Boolean.FALSE)) {
				ApiServletSupport.serverError(response, "필수 Oracle 시퀀스가 없습니다.", data);
				return;
			}
		} catch (Exception error) {
			data.put("database", "error");
			ApiServletSupport.serverError(response, "Oracle DB 연결 또는 시퀀스 확인에 실패했습니다.", data);
			return;
		}

		try {
			Path uploadDirectory = UploadStorage.directory("health");
			Path probe = Files.createTempFile(uploadDirectory, "airnote-", ".tmp");
			Files.deleteIfExists(probe);
			data.put("uploadStorage", uploadDirectory.getParent().toString());
			data.put("uploadWritable", true);
		} catch (Exception error) {
			data.put("uploadWritable", false);
			ApiServletSupport.serverError(response, "업로드 저장소에 쓸 수 없습니다.", data);
			return;
		}

		ApiServletSupport.success(response, "AirNote backend is ready.", data);
	}

	private boolean sequenceExists(Connection connection, String sequenceName) throws Exception {
		String sql = "SELECT COUNT(*) FROM USER_SEQUENCES WHERE SEQUENCE_NAME = ?";
		try (PreparedStatement statement = connection.prepareStatement(sql)) {
			statement.setString(1, sequenceName);
			try (ResultSet resultSet = statement.executeQuery()) {
				return resultSet.next() && resultSet.getInt(1) > 0;
			}
		}
	}
}
