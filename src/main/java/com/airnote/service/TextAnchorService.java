package com.airnote.service;

import java.util.List;

import com.airnote.dao.TextAnchorDAO;
import com.airnote.model.TextAnchor;

// 현재 페이지의 텍스트 앵커 목록 조회 기능을 처리하는 서비스

public class TextAnchorService {

	private TextAnchorDAO textAnchorDAO = new TextAnchorDAO();

	public List<TextAnchor> getTextAnchors(int pdfId, int pageNo) {
		return textAnchorDAO.selectTextAnchors(pdfId, pageNo);
	}
}