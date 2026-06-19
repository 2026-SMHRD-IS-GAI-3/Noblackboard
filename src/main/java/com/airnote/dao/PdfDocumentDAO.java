package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;

import com.airnote.model.PdfDocument;
import com.airnote.util.DBUtil;

// TB_PDF_DOCUMENT 테이블에 PDF 문서 정보를 저장/조회하는 DB 클래스

public class PdfDocumentDAO {

	public int insertPdfDocument(PdfDocument pdfDocument) {
		int pdfId = 0;

		String sql = "INSERT INTO TB_PDF_DOCUMENT " + "(PDF_ID, USER_ID, FILE_NAME, UPLOAD_DATE, PAGE_COUNT) "
				+ "VALUES (SEQ_PDF_ID.NEXTVAL, ?, ?, SYSDATE, ?)";

		String selectSql = "SELECT SEQ_PDF_ID.CURRVAL FROM DUAL";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, pdfDocument.getUserId());
			ps.setString(2, pdfDocument.getFileName());

			if (pdfDocument.getPageCount() == null) {
				ps.setNull(3, Types.NUMERIC);
			} else {
				ps.setInt(3, pdfDocument.getPageCount());
			}

			int result = ps.executeUpdate();

			if (result > 0) {
				try (PreparedStatement ps2 = conn.prepareStatement(selectSql); ResultSet rs = ps2.executeQuery()) {
					if (rs.next()) {
						pdfId = rs.getInt(1);
					}
				}
			}

		} catch (Exception e) {
			throw new IllegalStateException("PDF 문서 DB 저장에 실패했습니다.", e);
		}

		return pdfId;
	}
}
