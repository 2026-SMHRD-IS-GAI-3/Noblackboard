package com.airnote.common;

public class ApiResponse {

	public static String success(String message, String dataJson) {
		return "{" + "\"success\":true," + "\"message\":\"" + escape(message) + "\"," + "\"data\":" + dataJson + "}";
	}

	public static String fail(String message) {
		return "{" + "\"success\":false," + "\"message\":\"" + escape(message) + "\"" + "}";
	}

	public static String escape(String text) {
		if (text == null) {
			return "";
		}

		return text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
	}
}