package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import com.airnote.model.SpeechHabitAnalysis;
import com.airnote.model.SpeechLog;
import com.airnote.util.DBUtil;

public class SpeechDAO {

	public int insertSpeechLog(SpeechLog speechLog) {
		String idSql = "SELECT SEQ_SPEECH_LOG_ID.NEXTVAL FROM DUAL";

		String insertSql = "" + "INSERT INTO TB_SPEECH_LOG ("
				+ "  SPEECH_LOG_ID, PRESENTATION_ID, PAGE_NO, SPEECH_TEXT, DETECTED_AT, CREATED_AT" + ") VALUES ("
				+ "  ?, ?, ?, ?, SYSDATE, SYSDATE" + ")";

		Connection conn = null;
		PreparedStatement psId = null;
		PreparedStatement psInsert = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();

			psId = conn.prepareStatement(idSql);
			rs = psId.executeQuery();

			int speechLogId = 0;

			if (rs.next()) {
				speechLogId = rs.getInt(1);
			}

			psInsert = conn.prepareStatement(insertSql);
			psInsert.setInt(1, speechLogId);
			psInsert.setInt(2, speechLog.getPresentationId());

			if (speechLog.getPageNo() > 0) {
				psInsert.setInt(3, speechLog.getPageNo());
			} else {
				psInsert.setNull(3, java.sql.Types.NUMERIC);
			}

			psInsert.setString(4, speechLog.getSpeechText());

			int result = psInsert.executeUpdate();

			if (result > 0) {
				return speechLogId;
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

	public List<String> selectSpeechTextsByPresentationId(int presentationId) {
		List<String> speechTexts = new ArrayList<>();

		String sql = "" + "SELECT SPEECH_TEXT " + "FROM TB_SPEECH_LOG " + "WHERE PRESENTATION_ID = ? "
				+ "ORDER BY DETECTED_AT ASC, SPEECH_LOG_ID ASC";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			while (rs.next()) {
				speechTexts.add(rs.getString("SPEECH_TEXT"));
			}

			return speechTexts;

		} catch (Exception e) {
			e.printStackTrace();
			return speechTexts;
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}
	}

	public int deleteHabitAnalysisByPresentationId(int presentationId) {
		String sql = "" + "DELETE FROM TB_SPEECH_HABIT_ANALYSIS " + "WHERE PRESENTATION_ID = ?";

		Connection conn = null;
		PreparedStatement ps = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			return ps.executeUpdate();

		} catch (Exception e) {
			e.printStackTrace();
			return 0;
		} finally {
			close(ps);
			close(conn);
		}
	}

	public int insertHabitAnalysis(int presentationId, String fillerWord, int fillerCount) {
		String idSql = "SELECT SEQ_SPEECH_ANALYSIS_ID.NEXTVAL FROM DUAL";

		String insertSql = "" + "INSERT INTO TB_SPEECH_HABIT_ANALYSIS ("
				+ "  ANALYSIS_ID, PRESENTATION_ID, FILLER_WORD, FILLER_COUNT, CREATED_AT" + ") VALUES ("
				+ "  ?, ?, ?, ?, SYSDATE" + ")";

		Connection conn = null;
		PreparedStatement psId = null;
		PreparedStatement psInsert = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();

			psId = conn.prepareStatement(idSql);
			rs = psId.executeQuery();

			int analysisId = 0;

			if (rs.next()) {
				analysisId = rs.getInt(1);
			}

			psInsert = conn.prepareStatement(insertSql);
			psInsert.setInt(1, analysisId);
			psInsert.setInt(2, presentationId);
			psInsert.setString(3, fillerWord);
			psInsert.setInt(4, fillerCount);

			return psInsert.executeUpdate();

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

	public List<SpeechHabitAnalysis> selectHabitAnalysisByPresentationId(int presentationId) {
		List<SpeechHabitAnalysis> list = new ArrayList<>();

		String sql = "" + "SELECT ANALYSIS_ID, PRESENTATION_ID, FILLER_WORD, FILLER_COUNT, CREATED_AT "
				+ "FROM TB_SPEECH_HABIT_ANALYSIS " + "WHERE PRESENTATION_ID = ? " + "ORDER BY " + "  CASE FILLER_WORD "
				+ "    WHEN '음' THEN 1 " + "    WHEN '어' THEN 2 " + "    WHEN '아' THEN 3 " + "    ELSE 4 " + "  END";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			while (rs.next()) {
				SpeechHabitAnalysis analysis = new SpeechHabitAnalysis();

				analysis.setAnalysisId(rs.getInt("ANALYSIS_ID"));
				analysis.setPresentationId(rs.getInt("PRESENTATION_ID"));
				analysis.setFillerWord(rs.getString("FILLER_WORD"));
				analysis.setFillerCount(rs.getInt("FILLER_COUNT"));
				analysis.setCreatedAt(rs.getTimestamp("CREATED_AT"));

				list.add(analysis);
			}

			return list;

		} catch (Exception e) {
			e.printStackTrace();
			return list;
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