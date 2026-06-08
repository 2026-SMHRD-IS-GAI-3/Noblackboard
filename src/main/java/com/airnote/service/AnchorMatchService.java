package com.airnote.service;

import com.airnote.dao.AnchorMatchDAO;
import com.airnote.model.AnchorMatchLog;

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