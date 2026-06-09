package com.airnote.common;

/*
 * 판서 시작 방식 구분값.
 * MANUAL      : 사용자가 직접 손 제스처로 시작점을 잡은 경우
 * VOICE_START : 음성 키워드 매칭으로 시작점을 잡은 경우
 */
public class SourceType {

	public static final String MANUAL = "MANUAL";
	public static final String VOICE_START = "VOICE_START";

	private SourceType() {
	}
}