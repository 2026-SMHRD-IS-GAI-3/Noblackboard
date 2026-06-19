package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import com.airnote.model.Annotation;
import com.airnote.util.DBUtil;

public class AnnotationDAO {

	public int insertAnnotation(Annotation annotation) {
		String idSql = "SELECT SEQ_ANNOTATION_ID.NEXTVAL FROM DUAL";

		String insertSql = "" + "INSERT INTO TB_ANNOTATION ("
				+ "  ANNOTATION_ID, PRESENTATION_ID, PAGE_NO, TOOL_TYPE, COLOR, " + "  START_X, START_Y, END_X, END_Y, "
				+ "  ANCHOR_ID, MATCH_LOG_ID, SOURCE_TYPE, MATCH_CONFIDENCE, CREATED_AT" + ") VALUES ("
				+ "  ?, ?, ?, ?, ?, " + "  ?, ?, ?, ?, " + "  ?, ?, ?, ?, SYSDATE" + ")";

		Connection conn = null;
		PreparedStatement psId = null;
		PreparedStatement psInsert = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();

			psId = conn.prepareStatement(idSql);
			rs = psId.executeQuery();

			int annotationId = 0;
			if (rs.next()) {
				annotationId = rs.getInt(1);
			}

			psInsert = conn.prepareStatement(insertSql);
			psInsert.setInt(1, annotationId);
			psInsert.setInt(2, annotation.getPresentationId());
			psInsert.setInt(3, annotation.getPageNo());
			psInsert.setString(4, annotation.getToolType());
			psInsert.setString(5, annotation.getColor());
			psInsert.setDouble(6, annotation.getStartX());
			psInsert.setDouble(7, annotation.getStartY());
			psInsert.setDouble(8, annotation.getEndX());
			psInsert.setDouble(9, annotation.getEndY());

			if (annotation.getAnchorId() != null && annotation.getAnchorId() > 0) {
				psInsert.setInt(10, annotation.getAnchorId());
			} else {
				psInsert.setNull(10, java.sql.Types.NUMERIC);
			}

			if (annotation.getMatchLogId() != null && annotation.getMatchLogId() > 0) {
				psInsert.setInt(11, annotation.getMatchLogId());
			} else {
				psInsert.setNull(11, java.sql.Types.NUMERIC);
			}

			psInsert.setString(12, annotation.getSourceType());

			if (annotation.getMatchConfidence() != null) {
				psInsert.setDouble(13, annotation.getMatchConfidence());
			} else {
				psInsert.setNull(13, java.sql.Types.NUMERIC);
			}

			int result = psInsert.executeUpdate();

			if (result > 0) {
				return annotationId;
			}

			return 0;

		} catch (Exception e) {
			throw new IllegalStateException("판서 DB 저장에 실패했습니다.", e);
		} finally {
			close(rs);
			close(psId);
			close(psInsert);
			close(conn);
		}
	}

	public List<Annotation> selectAnnotationList(int presentationId) {
		List<Annotation> list = new ArrayList<>();

		String sql = "" + "SELECT " + "  ANNOTATION_ID, PRESENTATION_ID, PAGE_NO, TOOL_TYPE, COLOR, "
				+ "  START_X, START_Y, END_X, END_Y, "
				+ "  ANCHOR_ID, MATCH_LOG_ID, SOURCE_TYPE, MATCH_CONFIDENCE, CREATED_AT, "
				+ "  DELETED_YN, DELETED_AT, DELETE_TYPE " + "FROM TB_ANNOTATION " + "WHERE PRESENTATION_ID = ? "
				+ "  AND NVL(DELETED_YN, 'N') = 'N' " + "ORDER BY CREATED_AT ASC";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);
			rs = ps.executeQuery();

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
				annotation.setAnchorId(rs.getInt("ANCHOR_ID"));
				annotation.setMatchLogId(rs.getInt("MATCH_LOG_ID"));
				annotation.setSourceType(rs.getString("SOURCE_TYPE"));
				annotation.setMatchConfidence(rs.getDouble("MATCH_CONFIDENCE"));
				annotation.setCreatedAt(rs.getTimestamp("CREATED_AT"));
				annotation.setDeletedYn(rs.getString("DELETED_YN"));
				annotation.setDeletedAt(rs.getTimestamp("DELETED_AT"));
				annotation.setDeleteType(rs.getString("DELETE_TYPE"));

				list.add(annotation);
			}

		} catch (Exception e) {
			throw new IllegalStateException("판서 DB 조회에 실패했습니다.", e);
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}

		return list;
	}

	public int deleteAnnotation(int annotationId, int presentationId, String deleteType) {
		String sql = "" + "UPDATE TB_ANNOTATION " + "SET DELETED_YN = 'Y', " + "    DELETED_AT = SYSDATE, "
				+ "    DELETE_TYPE = ? " + "WHERE ANNOTATION_ID = ? " + "  AND PRESENTATION_ID = ? "
				+ "  AND NVL(DELETED_YN, 'N') = 'N'";

		Connection conn = null;
		PreparedStatement ps = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);

			ps.setString(1, deleteType);
			ps.setInt(2, annotationId);
			ps.setInt(3, presentationId);

			return ps.executeUpdate();

		} catch (Exception e) {
			throw new IllegalStateException("판서 DB 삭제에 실패했습니다.", e);
		} finally {
			close(ps);
			close(conn);
		}
	}

	private void close(AutoCloseable closeable) {
		if (closeable != null) {
			try {
				closeable.close();
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
}
