package com.airnote.service;

import com.airnote.dao.PdfDocumentDAO;
import com.airnote.model.PdfDocument;

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