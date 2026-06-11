package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import com.airnote.model.Annotation;
import com.airnote.util.DBUtil;

// TB_ANNOTATION 테이블에 판서/도구 사용 기록을 저장하는 DB 클래스

public class AnnotationDAO {

	public int insertAnnotation(Annotation annotation) {
		int annotationId = 0;

		String sql = "INSERT INTO TB_ANNOTATION " + "(ANNOTATION_ID, PRESENTATION_ID, PAGE_NO, TOOL_TYPE, COLOR, "
				+ "START_X, START_Y, END_X, END_Y, "
				+ "ANCHOR_ID, MATCH_LOG_ID, SOURCE_TYPE, MATCH_CONFIDENCE, CREATED_AT) "
				+ "VALUES (SEQ_ANNOTATION_ID.NEXTVAL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATE)";

		String selectSql = "SELECT SEQ_ANNOTATION_ID.CURRVAL FROM DUAL";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, annotation.getPresentationId());
			ps.setInt(2, annotation.getPageNo());
			ps.setString(3, annotation.getToolType());
			ps.setString(4, annotation.getColor());
			ps.setDouble(5, annotation.getStartX());
			ps.setDouble(6, annotation.getStartY());
			ps.setDouble(7, annotation.getEndX());
			ps.setDouble(8, annotation.getEndY());

			if (annotation.getAnchorId() == null) {
				ps.setNull(9, java.sql.Types.NUMERIC);
			} else {
				ps.setInt(9, annotation.getAnchorId());
			}

			if (annotation.getMatchLogId() == null) {
				ps.setNull(10, java.sql.Types.NUMERIC);
			} else {
				ps.setInt(10, annotation.getMatchLogId());
			}

			ps.setString(11, annotation.getSourceType());

			if (annotation.getMatchConfidence() == null) {
				ps.setNull(12, java.sql.Types.NUMERIC);
			} else {
				ps.setDouble(12, annotation.getMatchConfidence());
			}

			int result = ps.executeUpdate();

			if (result > 0) {
				try (PreparedStatement ps2 = conn.prepareStatement(selectSql); ResultSet rs = ps2.executeQuery()) {
					if (rs.next()) {
						annotationId = rs.getInt(1);
					}
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return annotationId;
	}

	// 특정 발표의 판서 기록 목록 조회
	public java.util.List<Annotation> selectAnnotationList(int presentationId) {
		java.util.List<Annotation> list = new java.util.ArrayList<>();

		String sql = "SELECT ANNOTATION_ID, PRESENTATION_ID, PAGE_NO, TOOL_TYPE, COLOR, "
				+ "START_X, START_Y, END_X, END_Y, " + "ANCHOR_ID, MATCH_LOG_ID, SOURCE_TYPE, MATCH_CONFIDENCE "
				+ "FROM TB_ANNOTATION " + "WHERE PRESENTATION_ID = ? " + "ORDER BY ANNOTATION_ID";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentationId);

			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					Annotation annotation = new Annotation();

					annotation.setAnnotationId(rs.getInt("ANNOTATION_ID"));
					annotation.setPresentationId(rs.getInt("PRESENTATION_ID"));
					annotation.setPageNo(rs.getInt("PAGE_NO"));
					annotation.setToolType(rs.getString("TOOL_TYPE"));
					annotation.setColor(rs.getString("COLOR"));
					annotation.setStartX(rs.getDouble("START_X"));
					annotation.setStartY(rs.getDouble("START_Y"));
					annotation.setEndX(rs.getDouble("END_X"));
					annotation.setEndY(rs.getDouble("END_Y"));

					if (rs.getObject("ANCHOR_ID") == null) {
						annotation.setAnchorId(null);
					} else {
						annotation.setAnchorId(rs.getInt("ANCHOR_ID"));
					}

					if (rs.getObject("MATCH_LOG_ID") == null) {
						annotation.setMatchLogId(null);
					} else {
						annotation.setMatchLogId(rs.getInt("MATCH_LOG_ID"));
					}

					annotation.setSourceType(rs.getString("SOURCE_TYPE"));

					if (rs.getObject("MATCH_CONFIDENCE") == null) {
						annotation.setMatchConfidence(null);
					} else {
						annotation.setMatchConfidence(rs.getDouble("MATCH_CONFIDENCE"));
					}

					list.add(annotation);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return list;
	}
}