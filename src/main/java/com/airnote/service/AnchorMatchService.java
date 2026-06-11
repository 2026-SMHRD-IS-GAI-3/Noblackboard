package com.airnote.service;

import com.airnote.dao.AnchorMatchDAO;
import com.airnote.model.AnchorMatchLog;

// 음성 문장 매칭 로그와 후보 점수 저장 흐름을 처리하는 서비스

public class AnchorMatchService {

	private AnchorMatchDAO anchorMatchDAO = new AnchorMatchDAO();

	// 앵커 매칭 로그 저장(저장용)
	public int saveAnchorMatchLog(AnchorMatchLog log) {
		return anchorMatchDAO.insertAnchorMatchLog(log);
	}

	// 특정 발표의 앵커 매칭 로그 목록 조회(조회용)
	public java.util.List<AnchorMatchLog> getAnchorMatchLogList(int presentationId) {
		return anchorMatchDAO.selectAnchorMatchLogList(presentationId);
	}
}