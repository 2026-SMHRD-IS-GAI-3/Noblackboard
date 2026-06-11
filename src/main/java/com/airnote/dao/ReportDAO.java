package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.airnote.model.AnnotationSummary;
import com.airnote.model.SlideDuration;
import com.airnote.util.DBUtil;

public class ReportDAO {

	public int selectTotalDurationSec(int presentationId) {
		String sql = ""
				+ "SELECT NVL(ROUND((NVL(END_TIME, SYSDATE) - START_TIME) * 24 * 60 * 60), 0) AS TOTAL_DURATION_SEC "
				+ "FROM TB_PRESENTATION " + "WHERE PRESENTATION_ID = ?";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			if (rs.next()) {
				return rs.getInt("TOTAL_DURATION_SEC");
			}

			return 0;

		} catch (Exception e) {
			e.printStackTrace();
			return 0;
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}
	}

	public SlideDuration selectMostViewedSlide(int presentationId) {
		String sql = "" + "SELECT * " + "FROM ( " + "  SELECT PAGE_NO, SUM(NVL(DURATION_SEC, 0)) AS DURATION_SEC "
				+ "  FROM TB_SLIDE_VIEW_LOG " + "  WHERE PRESENTATION_ID = ? " + "  GROUP BY PAGE_NO "
				+ "  ORDER BY DURATION_SEC DESC " + ") " + "WHERE ROWNUM = 1";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			if (rs.next()) {
				SlideDuration slide = new SlideDuration();
				slide.setPageNo(rs.getInt("PAGE_NO"));
				slide.setDurationSec(rs.getInt("DURATION_SEC"));
				return slide;
			}

			return new SlideDuration(0, 0);

		} catch (Exception e) {
			e.printStackTrace();
			return new SlideDuration(0, 0);
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}
	}

	public int selectPageMoveCount(int presentationId) {
		String sql = "" + "SELECT COUNT(*) AS PAGE_MOVE_COUNT " + "FROM TB_PAGE_ACTION " + "WHERE PRESENTATION_ID = ?";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			if (rs.next()) {
				return rs.getInt("PAGE_MOVE_COUNT");
			}

			return 0;

		} catch (Exception e) {
			e.printStackTrace();
			return 0;
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}
	}

	public AnnotationSummary selectAnnotationSummary(int presentationId) {
		String sql = "" + "SELECT TOOL_TYPE, COUNT(*) AS CNT " + "FROM TB_ANNOTATION " + "WHERE PRESENTATION_ID = ? "
				+ "  AND NVL(DELETED_YN, 'N') = 'N' " + "GROUP BY TOOL_TYPE";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		AnnotationSummary summary = new AnnotationSummary();

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			while (rs.next()) {
				String toolType = rs.getString("TOOL_TYPE");
				int count = rs.getInt("CNT");

				if ("POINTER".equals(toolType)) {
					summary.setPointerCount(count);
				} else if ("HIGHLIGHT".equals(toolType)) {
					summary.setHighlightCount(count);
				} else if ("UNDERLINE".equals(toolType)) {
					summary.setUnderlineCount(count);
				} else if ("ERASER".equals(toolType)) {
					summary.setEraserCount(count);
				}
			}

			return summary;

		} catch (Exception e) {
			e.printStackTrace();
			return summary;
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}
	}

	public List<SlideDuration> selectSlideDurations(int presentationId) {
		String sql = "" + "SELECT PAGE_NO, SUM(NVL(DURATION_SEC, 0)) AS DURATION_SEC " + "FROM TB_SLIDE_VIEW_LOG "
				+ "WHERE PRESENTATION_ID = ? " + "GROUP BY PAGE_NO " + "ORDER BY PAGE_NO";

		List<SlideDuration> list = new ArrayList<>();

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			while (rs.next()) {
				SlideDuration slide = new SlideDuration();
				slide.setPageNo(rs.getInt("PAGE_NO"));
				slide.setDurationSec(rs.getInt("DURATION_SEC"));

				list.add(slide);
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

	public Map<String, Object> selectSpeechHabitAnalysis(int presentationId) {
		String sql = "" + "SELECT FILLER_WORD, FILLER_COUNT " + "FROM TB_SPEECH_HABIT_ANALYSIS "
				+ "WHERE PRESENTATION_ID = ? " + "ORDER BY " + "  CASE FILLER_WORD " + "    WHEN '음' THEN 1 "
				+ "    WHEN '어' THEN 2 " + "    WHEN '아' THEN 3 " + "    ELSE 4 " + "  END";

		Connection conn = null;
		PreparedStatement ps = null;
		ResultSet rs = null;

		Map<String, Integer> countMap = new LinkedHashMap<>();
		countMap.put("음", 0);
		countMap.put("어", 0);
		countMap.put("아", 0);

		try {
			conn = DBUtil.getConnection();
			ps = conn.prepareStatement(sql);
			ps.setInt(1, presentationId);

			rs = ps.executeQuery();

			while (rs.next()) {
				String word = rs.getString("FILLER_WORD");
				int count = rs.getInt("FILLER_COUNT");

				if (countMap.containsKey(word)) {
					countMap.put(word, count);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			close(rs);
			close(ps);
			close(conn);
		}

		int totalFillerCount = 0;
		List<Map<String, Object>> fillerWords = new ArrayList<>();

		for (Map.Entry<String, Integer> entry : countMap.entrySet()) {
			totalFillerCount += entry.getValue();

			Map<String, Object> wordMap = new LinkedHashMap<>();
			wordMap.put("word", entry.getKey());
			wordMap.put("count", entry.getValue());

			fillerWords.add(wordMap);
		}

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("totalFillerCount", totalFillerCount);
		result.put("fillerWords", fillerWords);

		return result;
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