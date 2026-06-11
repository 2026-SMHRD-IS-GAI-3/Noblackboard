package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;

import com.airnote.model.AnchorMatchLog;
import com.airnote.util.DBUtil;

// TB_ANCHOR_MATCH_LOG, TB_ANCHOR_MATCH_CANDIDATE에 음성 매칭 결과를 저장하는 DB 클래스

public class AnchorMatchDAO {

	// 앵커 매칭 로그 저장
	public int insertAnchorMatchLog(AnchorMatchLog log) {
		int matchLogId = 0;

		String sql = "INSERT INTO TB_ANCHOR_MATCH_LOG " + "(MATCH_LOG_ID, PRESENTATION_ID, PDF_ID, PAGE_NO, "
				+ "STT_TEXT, STT_NORMALIZED, EXTRACTED_KEYWORDS, STT_CONFIDENCE, "
				+ "MATCH_STATUS, SELECTED_ANCHOR_ID, TOP_SCORE, SECOND_SCORE, SCORE_GAP, "
				+ "CANDIDATE_COUNT, THRESHOLD_SCORE, AMBIGUOUS_GAP, "
				+ "FAIL_REASON_CODE, DECISION_REASON, MATCH_ALGORITHM, ACTION_TYPE, " + "PROCESS_TIME_MS, CREATED_AT) "
				+ "VALUES (SEQ_MATCH_LOG_ID.NEXTVAL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATE)";

		String selectSql = "SELECT SEQ_MATCH_LOG_ID.CURRVAL FROM DUAL";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, log.getPresentationId());
			ps.setInt(2, log.getPdfId());
			ps.setInt(3, log.getPageNo());

			ps.setString(4, log.getSttText());
			ps.setString(5, log.getSttNormalized());
			ps.setString(6, log.getExtractedKeywords());

			if (log.getSttConfidence() == null) {
				ps.setNull(7, Types.NUMERIC);
			} else {
				ps.setDouble(7, log.getSttConfidence());
			}

			ps.setString(8, log.getMatchStatus());

			if (log.getSelectedAnchorId() == null) {
				ps.setNull(9, Types.NUMERIC);
			} else {
				ps.setInt(9, log.getSelectedAnchorId());
			}

			if (log.getTopScore() == null) {
				ps.setNull(10, Types.NUMERIC);
			} else {
				ps.setDouble(10, log.getTopScore());
			}

			if (log.getSecondScore() == null) {
				ps.setNull(11, Types.NUMERIC);
			} else {
				ps.setDouble(11, log.getSecondScore());
			}

			if (log.getScoreGap() == null) {
				ps.setNull(12, Types.NUMERIC);
			} else {
				ps.setDouble(12, log.getScoreGap());
			}

			if (log.getCandidateCount() == null) {
				ps.setNull(13, Types.NUMERIC);
			} else {
				ps.setInt(13, log.getCandidateCount());
			}

			if (log.getThresholdScore() == null) {
				ps.setNull(14, Types.NUMERIC);
			} else {
				ps.setDouble(14, log.getThresholdScore());
			}

			if (log.getAmbiguousGap() == null) {
				ps.setNull(15, Types.NUMERIC);
			} else {
				ps.setDouble(15, log.getAmbiguousGap());
			}

			ps.setString(16, log.getFailReasonCode());
			ps.setString(17, log.getDecisionReason());
			ps.setString(18, log.getMatchAlgorithm());
			ps.setString(19, log.getActionType());

			if (log.getProcessTimeMs() == null) {
				ps.setNull(20, Types.NUMERIC);
			} else {
				ps.setInt(20, log.getProcessTimeMs());
			}

			int result = ps.executeUpdate();

			if (result > 0) {
				try (PreparedStatement ps2 = conn.prepareStatement(selectSql); ResultSet rs = ps2.executeQuery()) {
					if (rs.next()) {
						matchLogId = rs.getInt(1);
					}
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return matchLogId;
	}

	// 특정 발표의 앵커 매칭 로그 목록 조회
	public java.util.List<AnchorMatchLog> selectAnchorMatchLogList(int presentationId) {
		java.util.List<AnchorMatchLog> list = new java.util.ArrayList<>();

		String sql = "SELECT MATCH_LOG_ID, PRESENTATION_ID, PDF_ID, PAGE_NO, "
				+ "STT_TEXT, STT_NORMALIZED, EXTRACTED_KEYWORDS, STT_CONFIDENCE, "
				+ "MATCH_STATUS, SELECTED_ANCHOR_ID, TOP_SCORE, SECOND_SCORE, SCORE_GAP, "
				+ "CANDIDATE_COUNT, THRESHOLD_SCORE, AMBIGUOUS_GAP, "
				+ "FAIL_REASON_CODE, DECISION_REASON, MATCH_ALGORITHM, ACTION_TYPE, PROCESS_TIME_MS "
				+ "FROM TB_ANCHOR_MATCH_LOG " + "WHERE PRESENTATION_ID = ? " + "ORDER BY MATCH_LOG_ID";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentationId);

			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					AnchorMatchLog log = new AnchorMatchLog();

					log.setMatchLogId(rs.getInt("MATCH_LOG_ID"));
					log.setPresentationId(rs.getInt("PRESENTATION_ID"));
					log.setPdfId(rs.getInt("PDF_ID"));
					log.setPageNo(rs.getInt("PAGE_NO"));

					log.setSttText(rs.getString("STT_TEXT"));
					log.setSttNormalized(rs.getString("STT_NORMALIZED"));
					log.setExtractedKeywords(rs.getString("EXTRACTED_KEYWORDS"));

					if (rs.getObject("STT_CONFIDENCE") == null) {
						log.setSttConfidence(null);
					} else {
						log.setSttConfidence(rs.getDouble("STT_CONFIDENCE"));
					}

					log.setMatchStatus(rs.getString("MATCH_STATUS"));

					if (rs.getObject("SELECTED_ANCHOR_ID") == null) {
						log.setSelectedAnchorId(null);
					} else {
						log.setSelectedAnchorId(rs.getInt("SELECTED_ANCHOR_ID"));
					}

					if (rs.getObject("TOP_SCORE") == null) {
						log.setTopScore(null);
					} else {
						log.setTopScore(rs.getDouble("TOP_SCORE"));
					}

					if (rs.getObject("SECOND_SCORE") == null) {
						log.setSecondScore(null);
					} else {
						log.setSecondScore(rs.getDouble("SECOND_SCORE"));
					}

					if (rs.getObject("SCORE_GAP") == null) {
						log.setScoreGap(null);
					} else {
						log.setScoreGap(rs.getDouble("SCORE_GAP"));
					}

					if (rs.getObject("CANDIDATE_COUNT") == null) {
						log.setCandidateCount(null);
					} else {
						log.setCandidateCount(rs.getInt("CANDIDATE_COUNT"));
					}

					if (rs.getObject("THRESHOLD_SCORE") == null) {
						log.setThresholdScore(null);
					} else {
						log.setThresholdScore(rs.getDouble("THRESHOLD_SCORE"));
					}

					if (rs.getObject("AMBIGUOUS_GAP") == null) {
						log.setAmbiguousGap(null);
					} else {
						log.setAmbiguousGap(rs.getDouble("AMBIGUOUS_GAP"));
					}

					log.setFailReasonCode(rs.getString("FAIL_REASON_CODE"));
					log.setDecisionReason(rs.getString("DECISION_REASON"));
					log.setMatchAlgorithm(rs.getString("MATCH_ALGORITHM"));
					log.setActionType(rs.getString("ACTION_TYPE"));

					if (rs.getObject("PROCESS_TIME_MS") == null) {
						log.setProcessTimeMs(null);
					} else {
						log.setProcessTimeMs(rs.getInt("PROCESS_TIME_MS"));
					}

					list.add(log);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return list;
	}
}