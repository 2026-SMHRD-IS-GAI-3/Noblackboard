package com.airnote.common;
// 모든 API 응답을 success, message, data 형태로 통일해주는 공통 응답 클래스

import com.google.gson.Gson;

public class ApiResponse<T> {

	private boolean success;
	private String message;
	private T data;
	private transient String errorCode;

	public ApiResponse() {
	}

	public ApiResponse(boolean success, String message, T data, String errorCode) {
		this.success = success;
		this.message = message;
		this.data = data;
		this.errorCode = errorCode;
	}

	public static <T> ApiResponse<T> success(String message, T data) {
		return new ApiResponse<T>(true, message, data, null);
	}

	public static ApiResponse<Object> success(String message) {
		return new ApiResponse<Object>(true, message, null, null);
	}

	public static ApiResponse<Object> error(String message) {
		return new ApiResponse<Object>(false, message, null, null);
	}

	public static ApiResponse<Object> error(String message, String errorCode) {
		return new ApiResponse<Object>(false, message, null, errorCode);
	}

	public static ApiResponse<Object> fail(String message) {
		return new ApiResponse<Object>(false, message, null, null);
	}

	public static ApiResponse<Object> fail(String message, String errorCode) {
		return new ApiResponse<Object>(false, message, null, errorCode);
	}

	public String toJson() {
		return new Gson().toJson(this);
	}

	public boolean isSuccess() {
		return success;
	}

	public void setSuccess(boolean success) {
		this.success = success;
	}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}

	public T getData() {
		return data;
	}

	public void setData(T data) {
		this.data = data;
	}

	public String getErrorCode() {
		return errorCode;
	}

	public void setErrorCode(String errorCode) {
		this.errorCode = errorCode;
	}
}
