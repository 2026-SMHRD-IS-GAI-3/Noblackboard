package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import com.airnote.model.TextAnchor;
import com.airnote.util.DBUtil;

// TB_TEXT_ANCHOR 테이블에서 PDF 페이지별 텍스트 위치 정보를 조회하는 DB 클래스

public class TextAnchorDAO {

	public List<TextAnchor> selectTextAnchors(int pdfId, int pageNo) {
		List<TextAnchor> list = new ArrayList<>();

		String sql = "SELECT ANCHOR_ID, PDF_ID, PAGE_NO, TEXT_ORIGINAL, TEXT_NORMALIZED, KEYWORDS, "
				+ "X_RATIO, Y_RATIO, WIDTH_RATIO, HEIGHT_RATIO, "
				+ "START_X_RATIO, START_Y_RATIO, END_X_RATIO, END_Y_RATIO, "
				+ "COORD_SYSTEM, EXTRACT_SOURCE, CONFIDENCE " + "FROM TB_TEXT_ANCHOR " + "WHERE PDF_ID = ? "
				+ "AND PAGE_NO = ? " + "AND USE_YN = 'Y' " + "ORDER BY SORT_ORDER";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, pdfId);
			ps.setInt(2, pageNo);

			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					TextAnchor anchor = new TextAnchor();

					anchor.setAnchorId(rs.getInt("ANCHOR_ID"));
					anchor.setPdfId(rs.getInt("PDF_ID"));
					anchor.setPageNo(rs.getInt("PAGE_NO"));
					anchor.setTextOriginal(rs.getString("TEXT_ORIGINAL"));
					anchor.setTextNormalized(rs.getString("TEXT_NORMALIZED"));
					anchor.setKeywords(rs.getString("KEYWORDS"));
					anchor.setxRatio(rs.getDouble("X_RATIO"));
					anchor.setyRatio(rs.getDouble("Y_RATIO"));
					anchor.setWidthRatio(rs.getDouble("WIDTH_RATIO"));
					anchor.setHeightRatio(rs.getDouble("HEIGHT_RATIO"));
					anchor.setStartXRatio(rs.getDouble("START_X_RATIO"));
					anchor.setStartYRatio(rs.getDouble("START_Y_RATIO"));
					anchor.setEndXRatio(rs.getDouble("END_X_RATIO"));
					anchor.setEndYRatio(rs.getDouble("END_Y_RATIO"));
					anchor.setCoordSystem(rs.getString("COORD_SYSTEM"));
					anchor.setExtractSource(rs.getString("EXTRACT_SOURCE"));
					anchor.setConfidence(rs.getDouble("CONFIDENCE"));

					list.add(anchor);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return list;
	}
}