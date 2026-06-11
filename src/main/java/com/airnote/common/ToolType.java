package com.airnote.common;

// 판서 도구 종류인 POINTER, HIGHLIGHT, UNDERLINE, ERASER 값을 관리하는 공통 클래스
// DB의 TB_ANNOTATION.TOOL_TYPE 체크 조건과 맞춰 사용한다.

public class ToolType {

	public static final String POINTER = "POINTER";
	public static final String HIGHLIGHT = "HIGHLIGHT";
	public static final String UNDERLINE = "UNDERLINE";
	public static final String ERASER = "ERASER";

	private ToolType() {
	}
}