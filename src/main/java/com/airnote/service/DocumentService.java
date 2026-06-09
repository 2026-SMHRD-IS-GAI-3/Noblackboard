package com.airnote.service;

import com.airnote.dao.PdfDocumentDAO;
import com.airnote.model.PdfDocument;

// PDF 파일 저장과 PDF 문서 정보 등록 흐름을 처리하는 서비스

public class DocumentService {

	private PdfDocumentDAO pdfDocumentDAO = new PdfDocumentDAO();

	public int savePdfDocument(int userId, String fileName, Integer pageCount) {
		PdfDocument pdfDocument = new PdfDocument();

		pdfDocument.setUserId(userId);
		pdfDocument.setFileName(fileName);
		pdfDocument.setPageCount(pageCount);

		return pdfDocumentDAO.insertPdfDocument(pdfDocument);
	}
}