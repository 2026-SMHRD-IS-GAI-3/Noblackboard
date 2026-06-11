package com.airnote.service;

import com.airnote.dao.SlideViewDAO;
import com.airnote.model.SlideViewLog;

public class SlideViewService {

	private SlideViewDAO slideViewDAO = new SlideViewDAO();

	public int startSlideView(int presentationId, int pageNo) {
		if (presentationId <= 0) {
			return 0;
		}

		if (pageNo <= 0) {
			return 0;
		}

		return slideViewDAO.startSlideView(presentationId, pageNo);
	}

	public SlideViewLog endSlideView(int slideViewId) {
		if (slideViewId <= 0) {
			return null;
		}

		return slideViewDAO.endSlideView(slideViewId);
	}
}