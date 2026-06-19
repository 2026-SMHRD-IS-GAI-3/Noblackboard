package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import com.airnote.model.Presentation;
import com.airnote.util.DBUtil;

// TB_PRESENTATION 테이블에 발표 시작, 종료, 목록, 상세 정보를 처리하는 DB 클래스

public class PresentationDAO {

	// 발표 시작
	public int insertPresentation(Presentation presentation) {

		String seqSql = "SELECT SEQ_PRESENTATION_ID.NEXTVAL FROM DUAL";

		String insertSql = "" + "INSERT INTO TB_PRESENTATION (" + "    PRESENTATION_ID, " + "    USER_ID, "
				+ "    PDF_ID, " + "    START_TIME, " + "    END_TIME " + ") VALUES (" + "    ?, " + "    ?, "
				+ "    ?, " + "    SYSDATE, " + "    NULL " + ")";

		try (Connection conn = DBUtil.getConnection()) {

			int presentationId = 0;

			try (PreparedStatement ps = conn.prepareStatement(seqSql); ResultSet rs = ps.executeQuery()) {

				if (rs.next()) {
					presentationId = rs.getInt(1);
				}
			}

			try (PreparedStatement ps = conn.prepareStatement(insertSql)) {

				ps.setInt(1, presentationId);
				ps.setInt(2, presentation.getUserId());
				ps.setInt(3, presentation.getPdfId());

				int result = ps.executeUpdate();

				if (result > 0) {
					return presentationId;
				}
			}
			return 0;

		} catch (Exception e) {
			throw new IllegalStateException("발표 시작 DB 저장에 실패했습니다.", e);
		}
	}

	// 발표 종료
	public int updateEndTime(int presentationId) {

		String sql = "" + "UPDATE TB_PRESENTATION " + "SET END_TIME = SYSDATE " + "WHERE PRESENTATION_ID = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setInt(1, presentationId);

			return ps.executeUpdate();

		} catch (Exception e) {
			throw new IllegalStateException("발표 종료 DB 저장에 실패했습니다.", e);
		}
	}

	// 발표 상세 조회
	public Presentation selectPresentationDetail(int presentationId) {

		String sql = "" + "SELECT " + "    PRESENTATION_ID, " + "    USER_ID, " + "    PDF_ID, "
				+ "    TO_CHAR(START_TIME, 'YYYY-MM-DD HH24:MI:SS') AS START_TIME, "
				+ "    TO_CHAR(END_TIME, 'YYYY-MM-DD HH24:MI:SS') AS END_TIME " + "FROM TB_PRESENTATION "
				+ "WHERE PRESENTATION_ID = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setInt(1, presentationId);

			try (ResultSet rs = ps.executeQuery()) {

				if (rs.next()) {
					Presentation presentation = new Presentation();

					presentation.setPresentationId(rs.getInt("PRESENTATION_ID"));
					presentation.setUserId(rs.getInt("USER_ID"));
					presentation.setPdfId(rs.getInt("PDF_ID"));
					presentation.setStartTime(rs.getString("START_TIME"));
					presentation.setEndTime(rs.getString("END_TIME"));

					return presentation;
				}
			}

		} catch (Exception e) {
			throw new IllegalStateException("발표 상세 DB 조회에 실패했습니다.", e);
		}

		return null;
	}

	// 발표 목록 조회
	public List<Presentation> selectPresentationsByUserId(int userId) {

		List<Presentation> list = new ArrayList<>();

		String sql = "" + "SELECT " + "    PRESENTATION_ID, " + "    USER_ID, " + "    PDF_ID, "
				+ "    TO_CHAR(START_TIME, 'YYYY-MM-DD HH24:MI:SS') AS START_TIME, "
				+ "    TO_CHAR(END_TIME, 'YYYY-MM-DD HH24:MI:SS') AS END_TIME " + "FROM TB_PRESENTATION "
				+ "WHERE USER_ID = ? " + "ORDER BY PRESENTATION_ID DESC";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setInt(1, userId);

			try (ResultSet rs = ps.executeQuery()) {

				while (rs.next()) {
					Presentation presentation = new Presentation();

					presentation.setPresentationId(rs.getInt("PRESENTATION_ID"));
					presentation.setUserId(rs.getInt("USER_ID"));
					presentation.setPdfId(rs.getInt("PDF_ID"));
					presentation.setStartTime(rs.getString("START_TIME"));
					presentation.setEndTime(rs.getString("END_TIME"));

					list.add(presentation);
				}
			}

		} catch (Exception e) {
			throw new IllegalStateException("발표 목록 DB 조회에 실패했습니다.", e);
		}

		return list;
	}
}
