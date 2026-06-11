package com.airnote.common;


// 음성-앵커 매칭 결과 상태인 SELECTED, AMBIGUOUS, NOT_FOUND 값을 관리하는 공통 클래스
// STT 문장과 TEXT_ANCHOR 매칭 결과 상태값.

public class MatchStatus {

	public static final String SELECTED = "SELECTED";
	public static final String AMBIGUOUS = "AMBIGUOUS";
	public static final String NOT_FOUND = "NOT_FOUND";

	private MatchStatus() {
	}
}