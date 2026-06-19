package com.airnote.service;

import com.airnote.dao.PageActionDAO;
import com.airnote.model.PageAction;

// 페이지 이동 기록 저장 기능을 처리하는 서비스

public class PageActionService {

	private PageActionDAO pageActionDAO = new PageActionDAO();

	// 페이지 이동 기록 저장
	public int savePageAction(PageAction pageAction) {
		if (pageAction == null || pageAction.getPresentationId() <= 0
				|| pageAction.getFromPageNo() <= 0 || pageAction.getToPageNo() <= 0) {
			return 0;
		}
		if (!"NEXT".equals(pageAction.getActionType()) && !"PREV".equals(pageAction.getActionType())) {
			return 0;
		}
		if ("NEXT".equals(pageAction.getActionType()) && pageAction.getToPageNo() <= pageAction.getFromPageNo()) {
			return 0;
		}
		if ("PREV".equals(pageAction.getActionType()) && pageAction.getToPageNo() >= pageAction.getFromPageNo()) {
			return 0;
		}
		return pageActionDAO.insertPageAction(pageAction);
	}

	// 특정 발표의 페이지 이동 기록 목록 조회
	public java.util.List<PageAction> getPageActionList(int presentationId) {
		return pageActionDAO.selectPageActionList(presentationId);
	}
}
