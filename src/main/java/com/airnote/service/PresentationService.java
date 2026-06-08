package com.airnote.service;

import com.airnote.dao.PresentationDAO;
import com.airnote.model.Presentation;

public class PresentationService {

	private PresentationDAO presentationDAO = new PresentationDAO();

	// 발표 시작
	public int startPresentation(int userId, int pdfId) {
		Presentation presentation = new Presentation(userId, pdfId);
		return presentationDAO.insertPresentation(presentation);
	}

	// 발표 종료
	public boolean endPresentation(int presentationId) {
		int result = presentationDAO.endPresentation(presentationId);
		return result > 0;
	}

	public java.util.List<Presentation> getPresentationList(int userId) {
		return presentationDAO.selectPresentationList(userId);
	}

	public Presentation getPresentationDetail(int presentationId) {
		return presentationDAO.selectPresentationDetail(presentationId);
	}
}