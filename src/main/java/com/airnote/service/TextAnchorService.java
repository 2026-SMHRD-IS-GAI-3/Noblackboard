package com.airnote.service;

import java.util.List;

import com.airnote.dao.TextAnchorDAO;
import com.airnote.model.TextAnchor;

public class TextAnchorService {

	private TextAnchorDAO textAnchorDAO = new TextAnchorDAO();

	public List<TextAnchor> getTextAnchors(int pdfId, int pageNo) {
		return textAnchorDAO.selectTextAnchors(pdfId, pageNo);
	}
}