package com.airnote.common;

import java.io.BufferedReader;
import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public final class ApiServletSupport {
	private static final Gson GSON = new GsonBuilder().serializeNulls().create();

	private ApiServletSupport() {
	}

	public static Gson gson() {
		return GSON;
	}

	public static <T> T readJson(HttpServletRequest request, Class<T> type) throws IOException {
		StringBuilder body = new StringBuilder();
		try (BufferedReader reader = request.getReader()) {
			String line;
			while ((line = reader.readLine()) != null) {
				body.append(line);
			}
		}
		return body.length() == 0 ? null : GSON.fromJson(body.toString(), type);
	}

	public static int requirePositiveInt(String name, String value) {
		if (value == null || value.trim().isEmpty()) {
			throw new IllegalArgumentException(name + "가 필요합니다.");
		}
		try {
			int parsed = Integer.parseInt(value);
			if (parsed <= 0) {
				throw new IllegalArgumentException(name + "는 1 이상의 숫자여야 합니다.");
			}
			return parsed;
		} catch (NumberFormatException error) {
			throw new IllegalArgumentException(name + "는 숫자여야 합니다.");
		}
	}

	public static void write(HttpServletResponse response, int status, ApiResponse<?> payload) throws IOException {
		response.setStatus(status);
		response.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");
		response.getWriter().write(GSON.toJson(payload));
	}

	public static void success(HttpServletResponse response, String message, Object data) throws IOException {
		write(response, HttpServletResponse.SC_OK, ApiResponse.success(message, data));
	}

	public static void badRequest(HttpServletResponse response, String message) throws IOException {
		write(response, HttpServletResponse.SC_BAD_REQUEST, ApiResponse.error(message, "INVALID_REQUEST"));
	}

	public static void notFound(HttpServletResponse response, String message) throws IOException {
		write(response, HttpServletResponse.SC_NOT_FOUND, ApiResponse.error(message, "NOT_FOUND"));
	}

	public static void conflict(HttpServletResponse response, String message) throws IOException {
		write(response, HttpServletResponse.SC_CONFLICT, ApiResponse.error(message, "CONFLICT"));
	}

	public static void serverError(HttpServletResponse response, String message) throws IOException {
		write(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, ApiResponse.error(message, "SERVER_ERROR"));
	}

	public static void serverError(HttpServletResponse response, String message, Object data) throws IOException {
		write(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
				new ApiResponse<Object>(false, message, data, "SERVER_ERROR"));
	}
}
