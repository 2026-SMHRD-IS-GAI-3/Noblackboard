package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import com.airnote.model.Presentation;
import com.airnote.util.DBUtil;

public class PresentationDAO {

	// 발표 시작 INSERT
	public int insertPresentation(Presentation presentation) {
		int presentationId = 0;

		String sql = "INSERT INTO TB_PRESENTATION " + "(PRESENTATION_ID, USER_ID, PDF_ID, START_TIME, END_TIME) "
				+ "VALUES (SEQ_PRESENTATION_ID.NEXTVAL, ?, ?, SYSDATE, NULL)";

		String selectSql = "SELECT SEQ_PRESENTATION_ID.CURRVAL FROM DUAL";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentation.getUserId());
			ps.setInt(2, presentation.getPdfId());

			int result = ps.executeUpdate();

			if (result > 0) {
				try (PreparedStatement ps2 = conn.prepareStatement(selectSql); ResultSet rs = ps2.executeQuery()) {
					if (rs.next()) {
						presentationId = rs.getInt(1);
					}
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return presentationId;
	}

	// 발표 종료 UPDATE
	public int endPresentation(int presentationId) {
		int result = 0;

		String sql = "UPDATE TB_PRESENTATION " + "SET END_TIME = SYSDATE " + "WHERE PRESENTATION_ID = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentationId);

			result = ps.executeUpdate();

		} catch (Exception e) {
			e.printStackTrace();
		}

		return result;
	}

	// 발표 기록 목록 조회
	public java.util.List<Presentation> selectPresentationList(int userId) {
		java.util.List<Presentation> list = new java.util.ArrayList<>();

		String sql = "SELECT PRESENTATION_ID, USER_ID, PDF_ID, START_TIME, END_TIME " + "FROM TB_PRESENTATION "
				+ "WHERE USER_ID = ? " + "ORDER BY PRESENTATION_ID DESC";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, userId);

			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					Presentation presentation = new Presentation();

					presentation.setPresentationId(rs.getInt("PRESENTATION_ID"));
					presentation.setUserId(rs.getInt("USER_ID"));
					presentation.setPdfId(rs.getInt("PDF_ID"));
					presentation.setStartTime(rs.getDate("START_TIME"));
					presentation.setEndTime(rs.getDate("END_TIME"));

					list.add(presentation);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return list;
	}

	// 발표 상세 조회
	public Presentation selectPresentationDetail(int presentationId) {
		Presentation presentation = null;

		String sql = "SELECT PRESENTATION_ID, USER_ID, PDF_ID, START_TIME, END_TIME " + "FROM TB_PRESENTATION "
				+ "WHERE PRESENTATION_ID = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentationId);

			try (ResultSet rs = ps.executeQuery()) {
				if (rs.next()) {
					presentation = new Presentation();

					presentation.setPresentationId(rs.getInt("PRESENTATION_ID"));
					presentation.setUserId(rs.getInt("USER_ID"));
					presentation.setPdfId(rs.getInt("PDF_ID"));
					presentation.setStartTime(rs.getDate("START_TIME"));
					presentation.setEndTime(rs.getDate("END_TIME"));
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return presentation;
	}
}