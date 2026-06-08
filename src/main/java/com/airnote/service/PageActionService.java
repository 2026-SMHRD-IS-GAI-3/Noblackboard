package com.airnote.service;

import com.airnote.dao.PageActionDAO;
import com.airnote.model.PageAction;

public class PageActionService {

	private PageActionDAO pageActionDAO = new PageActionDAO();

	// 페이지 이동 기록 저장
	public int savePageAction(PageAction pageAction) {
		return pageActionDAO.insertPageAction(pageAction);
	}

	// 특정 발표의 페이지 이동 기록 목록 조회
	public java.util.List<PageAction> getPageActionList(int presentationId) {
		return pageActionDAO.selectPageActionList(presentationId);
	}
}