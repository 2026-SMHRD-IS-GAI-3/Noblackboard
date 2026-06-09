package com.airnote.service;

import java.util.List;

import com.airnote.dao.PresentationDAO;
import com.airnote.dao.RecordDAO;
import com.airnote.model.Presentation;
import com.airnote.model.RecordImage;

// 발표 시작, 종료, 목록 조회, 상세 조회와 이미지 목록 연결을 처리하는 서비스

public class PresentationService {

	private PresentationDAO presentationDAO = new PresentationDAO();
	private RecordDAO recordDAO = new RecordDAO();

	// 발표 시작
	public Presentation startPresentation(int userId, int pdfId) {

		Presentation presentation = new Presentation();
		presentation.setUserId(userId);
		presentation.setPdfId(pdfId);

		int presentationId = presentationDAO.insertPresentation(presentation);

		if (presentationId == 0) {
			return null;
		}

		return presentationDAO.selectPresentationDetail(presentationId);
	}

	// 발표 종료
	public boolean endPresentation(int presentationId) {

		int result = presentationDAO.updateEndTime(presentationId);

		return result > 0;
	}

	// 발표 목록 조회
	public List<Presentation> getPresentationList(int userId) {

		return presentationDAO.selectPresentationsByUserId(userId);
	}

	// 혹시 다른 컨트롤러에서 이 이름을 쓰고 있을 때를 대비해서 남김
	public List<Presentation> getPresentationsByUserId(int userId) {

		return getPresentationList(userId);
	}

	// 발표 상세 조회 + 저장 이미지 목록 붙이기
	public Presentation getPresentationDetail(int presentationId) {

		Presentation presentation = presentationDAO.selectPresentationDetail(presentationId);

		if (presentation == null) {
			return null;
		}

		List<RecordImage> recordImages = recordDAO.selectImagesByPresentationId(presentationId);

		presentation.setRecordImages(recordImages);

		return presentation;
	}
}