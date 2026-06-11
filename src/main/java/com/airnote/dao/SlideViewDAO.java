package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import com.airnote.model.SlideViewLog;
import com.airnote.util.DBUtil;

public class SlideViewDAO {

	public int startSlideView(int presentationId, int pageNo) {
		String idSql = "SELECT SEQ_SLIDE_VIEW_ID.NEXTVAL FROM DUAL";

		String insertSql = "" + "INSERT INTO TB_SLIDE_VIEW_LOG ("
				+ "  SLIDE_VIEW_ID, PRESENTATION_ID, PAGE_NO, ENTER_TIME, CREATED_AT" + ") VALUES ("
				+ "  ?, ?, ?, SYSDATE, SYSDATE" + ")";

		Connection conn = null;
		PreparedStatement psId = null;
		PreparedStatement psInsert = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();

			psId = conn.prepareStatement(idSql);
			rs = psId.executeQuery();

			int slideViewId = 0;

			if (rs.next()) {
				slideViewId = rs.getInt(1);
			}

			psInsert = conn.prepareStatement(insertSql);
			psInsert.setInt(1, slideViewId);
			psInsert.setInt(2, presentationId);
			psInsert.setInt(3, pageNo);

			int result = psInsert.executeUpdate();

			if (result > 0) {
				return slideViewId;
			}

			return 0;

		} catch (Exception e) {
			e.printStackTrace();
			return 0;
		} finally {
			close(rs);
			close(psId);
			close(psInsert);
			close(conn);
		}
	}

	public SlideViewLog endSlideView(int slideViewId) {
		String updateSql = "" + "UPDATE TB_SLIDE_VIEW_LOG " + "SET EXIT_TIME = SYSDATE, "
				+ "    DURATION_SEC = ROUND((SYSDATE - ENTER_TIME) * 24 * 60 * 60) " + "WHERE SLIDE_VIEW_ID = ? "
				+ "  AND EXIT_TIME IS NULL";

		Connection conn = null;
		PreparedStatement ps = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(updateSql);
			ps.setInt(1, slideViewId);

			int result = ps.executeUpdate();

			if (result > 0) {
				return selectSlideViewById(slideViewId);
			}

			return null;

		} catch (Exception e) {
			e.printStackTrace();
			return null;
		} finally {
			close(ps);
			close(conn);
		}
	}

	public SlideViewLog selectSlideViewById(int slideViewId) {
		String sql = "" + "SELECT " + "  SLIDE_VIEW_ID, PRESENTATION_ID, PAGE_NO, "
				+ "  ENTER_TIME, EXIT_TIME, DURATION_SEC, CREATED_AT " + "FROM TB_SLIDE_VIEW_LOG "
				+ "WHERE SLIDE_VIEW_ID = ?";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, slideViewId);

			rs = ps.executeQuery();

			if (rs.next()) {
				SlideViewLog log = new SlideViewLog();

				log.setSlideViewId(rs.getInt("SLIDE_VIEW_ID"));
				log.setPresentationId(rs.getInt("PRESENTATION_ID"));
				log.setPageNo(rs.getInt("PAGE_NO"));
				log.setEnterTime(rs.getTimestamp("ENTER_TIME"));
				log.setExitTime(rs.getTimestamp("EXIT_TIME"));
				log.setDurationSec(rs.getInt("DURATION_SEC"));
				log.setCreatedAt(rs.getTimestamp("CREATED_AT"));

				return log;
			}

			return null;

		} catch (Exception e) {
			e.printStackTrace();
			return null;
		} finally {
			close(rs);
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